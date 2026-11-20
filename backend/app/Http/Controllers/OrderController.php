<?php

namespace App\Http\Controllers;

use App\Mail\OrderConfirmed;
use App\Models\Coupon;
use App\Models\CouponRedemption;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Plan;
use App\Models\Project;
use App\Models\ReferralUse;
use App\Models\UserAccess;
use App\Services\AdminNotificationService;
use App\Services\PlanUnlockMapService;
use App\Services\RazorpayGateway;
use App\Services\ReferralRewardService;
use App\Services\ShipmentService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\Rule;
use RuntimeException;

class OrderController extends Controller
{
    public function __construct(
        private readonly PlanUnlockMapService $planUnlockMapService,
        private readonly ReferralRewardService $referralRewardService,
        private readonly RazorpayGateway $razorpayGateway,
        private readonly ShipmentService $shipmentService,
    ) {}

    public function store(Request $request)
    {
        $validated = $request->validate([
            'project_id' => ['required', 'exists:projects,id'],
            'plan_id' => ['nullable', 'integer', 'exists:plans,id'],
            'coupon_code' => ['nullable', 'string', 'max:50'],
        ]);

        $user = $request->user();
        $project = Project::query()
            ->whereKey($validated['project_id'])
            ->where('is_active', true)
            ->firstOrFail();

        $isMiniProject = (string) $project->project_type === 'diploma_mini';
        $plan = null;
        $shipmentDetails = null;

        if ($isMiniProject) {
            if (! empty($validated['plan_id'])) {
                return response()->json([
                    'message' => 'Mini-project purchases do not use standard plans.',
                ], 422);
            }

            if ($project->offer_price === null || (float) $project->offer_price <= 0) {
                return response()->json([
                    'message' => 'This mini-project does not have a valid offer price configured.',
                ], 422);
            }
        } else {
            if (empty($validated['plan_id'])) {
                return response()->json([
                    'message' => 'A plan is required for standard project purchases.',
                ], 422);
            }

            $plan = Plan::query()
                ->whereKey($validated['plan_id'])
                ->where('is_active', true)
                ->firstOrFail();

            if (strtoupper(trim((string) $plan->code)) === 'ADDON') {
                return response()->json([
                    'message' => 'Document add-ons require a separate purchase flow.',
                ], 422);
            }

            try {
                $this->validatePlanConfiguration($plan);
            } catch (RuntimeException $e) {
                return response()->json(['message' => $e->getMessage()], 422);
            }
        }

        if ((bool) $project->is_iot) {
            $deliveryMethod = $request->input(
                'shipment.delivery_method',
                'delivery'
            );

            $shipmentDetails = $request->validate([
                'shipment.delivery_method' => [
                    'sometimes',
                    Rule::in(['delivery', 'pickup']),
                ],
                'shipment.recipient_name' => ['required', 'string', 'max:150'],
                'shipment.recipient_phone' => ['required', 'string', 'max:20'],
                'shipment.shipping_address' => [
                    Rule::requiredIf($deliveryMethod === 'delivery'),
                    'nullable',
                    'string',
                    'max:2000',
                ],
                'shipment.city' => [
                    Rule::requiredIf($deliveryMethod === 'delivery'),
                    'nullable',
                    'string',
                    'max:100',
                ],
                'shipment.state' => [
                    Rule::requiredIf($deliveryMethod === 'delivery'),
                    'nullable',
                    'string',
                    'max:100',
                ],
                'shipment.postal_code' => [
                    Rule::requiredIf($deliveryMethod === 'delivery'),
                    'nullable',
                    'string',
                    'max:20',
                ],
                'shipment.country' => [
                    Rule::requiredIf($deliveryMethod === 'delivery'),
                    'nullable',
                    'string',
                    'max:100',
                ],
                'shipment.quantity' => ['required', 'integer', 'min:1', 'max:10'],
            ])['shipment'];
            $shipmentDetails['delivery_method'] = $deliveryMethod;
        }

        $basePrice = $isMiniProject
            ? (float) $project->offer_price
            : (float) $plan->price;

        try {
            $order = DB::transaction(function () use (
                $validated,
                $user,
                $project,
                $plan,
                $basePrice,
                $shipmentDetails,
            ) {
                $existingOrder = Order::query()
                    ->where('user_id', $user->id)
                    ->where('project_id', $project->id)
                    ->whereIn('status', ['pending', 'partial'])
                    ->lockForUpdate()
                    ->latest('id')
                    ->first();

                if ($existingOrder) {
                    throw new RuntimeException(
                        'You already have an active order for this project.'
                    );
                }

                $coupon = null;
                $discountAmount = 0.00;

                if (! empty($validated['coupon_code'])) {
                    $coupon = Coupon::query()
                        ->where('code', strtoupper(trim($validated['coupon_code'])))
                        ->lockForUpdate()
                        ->first();

                    if (
                        ! $coupon
                        || ! $coupon->is_active
                        || ($coupon->valid_from && now()->lt($coupon->valid_from))
                        || ($coupon->valid_until && now()->gt($coupon->valid_until))
                        || (
                            $coupon->max_uses !== null
                            && (
                                (int) $coupon->used_count
                                + (int) CouponRedemption::query()
                                    ->where('coupon_id', $coupon->id)
                                    ->where('status', 'pending')
                                    ->count()
                            ) >= (int) $coupon->max_uses
                        )
                        || ! in_array($coupon->scope, ['site_wide', 'project'], true)
                        || (
                            $coupon->scope === 'project'
                            && (
                                ! $coupon->project_id
                                || (int) $coupon->project_id !== (int) $project->id
                            )
                        )
                    ) {
                        throw new RuntimeException(
                            'This coupon is invalid, expired, or not applicable to this project.'
                        );
                    }

                    if (
                        $coupon->source === 'referral_reward'
                        && (
                            ! $user->group_id
                            || (int) $coupon->owner_group_id !== (int) $user->group_id
                        )
                    ) {
                        throw new RuntimeException(
                            'This referral reward coupon belongs to another group.'
                        );
                    }

                    if (
                        ! in_array($coupon->type, ['percentage', 'fixed'], true)
                        || (float) $coupon->value <= 0
                        || (
                            $coupon->type === 'percentage'
                            && (float) $coupon->value > 100
                        )
                    ) {
                        throw new RuntimeException(
                            'This coupon has an invalid discount configuration.'
                        );
                    }

                    if (
                        $coupon->source === 'referral_reward'
                        && CouponRedemption::query()
                            ->where('coupon_id', $coupon->id)
                            ->whereIn('status', ['pending', 'redeemed'])
                            ->exists()
                    ) {
                        throw new RuntimeException(
                            'This referral reward coupon has already been used.'
                        );
                    }

                    $discountAmount = $coupon->type === 'percentage'
                        ? round($basePrice * ((float) $coupon->value / 100), 2)
                        : min($basePrice, (float) $coupon->value);
                }

                $order = Order::create([
                    'user_id' => $user->id,
                    'project_id' => $project->id,
                    'plan_id' => $plan?->id,
                    'base_price' => $basePrice,
                    'total' => max(0, round($basePrice - $discountAmount, 2)),
                    'status' => 'pending',
                    'coupon_id' => $coupon?->id,
                    'discount_amount' => $discountAmount,
                ]);

                if ($coupon) {
                    CouponRedemption::create([
                        'coupon_id' => $coupon->id,
                        'order_id' => $order->id,
                        'discount_amount' => $discountAmount,
                        'redeemed_at' => now(),
                        'status' => 'pending',
                    ]);
                }

                if ($shipmentDetails !== null) {
                    $shipment = $this->shipmentService->createForOrder(
                        $order->loadMissing(['project', 'user']),
                        $shipmentDetails,
                    );

                    AdminNotificationService::notifyAdmins(
                        'iot_shipment',
                        "New Shipment {$shipment->shipment_number}",
                        "A physical IoT order is ready for shipment management: {$project->title}.",
                        '/admin/shipments'
                    );
                }

                AdminNotificationService::notifyAdmins(
                    'order',
                    "New Order #{$order->id}",
                    "A student has placed a new order for {$project->title}.",
                    "/admin/orders/{$order->id}"
                );

                return $order;
            });

            return response()->json([
                'message' => 'Order created successfully.',
                'order' => $order->load([
                    'project', 'plan', 'payments', 'coupon', 'couponRedemption',
                    'shipment.events',
                ]),
            ], 201);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    public function activeOrder(Request $request, Project $project)
    {
        $order = Order::query()
            ->where('user_id', $request->user()->id)
            ->where('project_id', $project->id)
            ->whereIn('status', ['pending', 'partial'])
            ->with(['project', 'plan', 'payments', 'shipment.events'])
            ->latest('id')
            ->first();

        if (! $order) {
            return response()->json([
                'message' => 'No active order found for this project.',
            ], 404);
        }

        return response()->json([
            'order' => $order,
        ]);
    }

    public function nextPayment(Request $request, Order $order)
    {
        if ((int) $order->user_id !== (int) $request->user()->id) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $order->load(['plan', 'project']);
        if ($order->status === 'complete') {
            return response()->json(['message' => 'This order is already complete.'], 422);
        }

        try {
            $isMiniProject = $this->isMiniProjectOrder($order);
            if (! $isMiniProject) {
                $this->validatePlanConfiguration($order->plan);
            }

            $installmentNo = $order->payments()->where('status', 'success')->count() + 1;
            $totalInstallments = $isMiniProject ? 1 : (int) $order->plan->installments;
            if ($installmentNo > $totalInstallments) {
                throw new RuntimeException('No more installments are available.');
            }

            $amount = $isMiniProject
                ? (float) $order->total
                : $this->getInstallmentAmount($order, $installmentNo);
            $unlockRule = $isMiniProject
                ? $this->miniProjectUnlockRule($order->project)
                : $this->getUnlockRule($order->plan, $installmentNo);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'order_id' => $order->id,
            'installment_no' => $installmentNo,
            'amount' => number_format($amount, 2, '.', ''),
            'total_installments' => $totalInstallments,
            'unlock_percent' => $this->highestStage($unlockRule['stages']),
            'unlock_stages' => $unlockRule['stages'],
            'unlock_bundles' => $unlockRule['bundles'],
            'order_status' => $order->status,
            'payment_mode' => $this->razorpayGateway->activeConfiguration()
                ? 'razorpay'
                : 'development_test_payment',
            'iot_shipment' => $isMiniProject ? null : $this->getIoTShipmentInfo($order),
        ]);
    }

    public function createPayment(Request $request, Order $order)
    {
        if ((int) $order->user_id !== (int) $request->user()->id) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        try {
            $result = DB::transaction(function () use ($order) {
                $lockedOrder = Order::query()->whereKey($order->id)
                    ->lockForUpdate()->with(['plan', 'project'])->firstOrFail();

                if ($lockedOrder->status === 'complete') {
                    throw new RuntimeException('This order is already complete.');
                }

                $isMiniProject = $this->isMiniProjectOrder($lockedOrder);
                if (! $isMiniProject) {
                    $this->validatePlanConfiguration($lockedOrder->plan);
                }

                $installmentNo = $lockedOrder->payments()->where('status', 'success')->count() + 1;
                $totalInstallments = $isMiniProject ? 1 : (int) $lockedOrder->plan->installments;
                if ($installmentNo > $totalInstallments) {
                    throw new RuntimeException('No more installments are available.');
                }

                $existingPayment = $lockedOrder->payments()
                    ->where('installment_no', $installmentNo)
                    ->where('status', 'created')
                    ->lockForUpdate()->first();
                if ($existingPayment) {
                    $unlockRule = $isMiniProject
                        ? $this->miniProjectUnlockRule($lockedOrder->project)
                        : $this->getUnlockRule($lockedOrder->plan, $installmentNo);

                    return [
                        'payment' => $existingPayment,
                        'unlock_rule' => $unlockRule,
                        'order' => $lockedOrder,
                        'is_mini_project' => $isMiniProject,
                    ];
                }

                $amount = $isMiniProject
                    ? (float) $lockedOrder->total
                    : $this->getInstallmentAmount($lockedOrder, $installmentNo);
                $unlockRule = $isMiniProject
                    ? $this->miniProjectUnlockRule($lockedOrder->project)
                    : $this->getUnlockRule($lockedOrder->plan, $installmentNo);

                $payment = $lockedOrder->payments()->create([
                    'installment_no' => $installmentNo,
                    'amount' => $amount,
                    'status' => 'created',
                    'gateway_order_id' => null,
                    'gateway_payment_id' => null,
                    'paid_at' => null,
                ]);

                return ['payment' => $payment, 'unlock_rule' => $unlockRule, 'order' => $lockedOrder, 'is_mini_project' => $isMiniProject];
            });

            $payment = $result['payment'];
            $gateway = null;
            $configuration = $this->razorpayGateway->activeConfiguration();

            if ($configuration) {
                if (! $payment->gateway_order_id) {
                    try {
                        $gatewayOrder = $this->razorpayGateway->createOrder($payment);
                    } catch (\Throwable $exception) {
                        report($exception);

                        return response()->json([
                            'message' => 'Unable to start Razorpay checkout. Please try again.',
                        ], 502);
                    }

                    $payment->update(['gateway_order_id' => $gatewayOrder['id']]);
                } else {
                    $gatewayOrder = [
                        'id' => $payment->gateway_order_id,
                        'amount' => (int) round((float) $payment->amount * 100),
                        'currency' => 'INR',
                        'mode' => $configuration['mode'],
                        'key_id' => $configuration['key_id'],
                    ];
                }

                $gateway = [
                    'provider' => 'razorpay',
                    'mode' => $gatewayOrder['mode'],
                    'key_id' => $gatewayOrder['key_id'],
                    'order_id' => $gatewayOrder['id'],
                    'amount' => $gatewayOrder['amount'],
                    'currency' => $gatewayOrder['currency'],
                    'name' => 'Vidisha InnoVTech',
                    'description' => "Project payment installment {$payment->installment_no}",
                    'prefill' => [
                        'name' => $request->user()->name,
                        'email' => $request->user()->email,
                        'contact' => $request->user()->mobile,
                    ],
                ];
            } elseif (! app()->environment(['local', 'testing'])) {
                return response()->json([
                    'message' => 'Payment gateway is not configured. Please contact support.',
                ], 503);
            }

            return response()->json([
                'message' => 'Payment created successfully.',
                'payment' => $payment->fresh(),
                'payment_mode' => $gateway ? 'razorpay' : 'development_test_payment',
                'gateway' => $gateway,
                'unlock_percent' => $this->highestStage($result['unlock_rule']['stages']),
                'unlock_stages' => $result['unlock_rule']['stages'],
                'unlock_bundles' => $result['unlock_rule']['bundles'],
                'iot_shipment' => $result['is_mini_project'] ? null : $this->getIoTShipmentInfo($result['order']),
            ], 201);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    public function testSuccess(Request $request, Order $order, Payment $payment)
    {
        if (! app()->environment(['local', 'testing'])) {
            return response()->json(['message' => 'Test payment is available only in development/testing environment.'], 403);
        }

        return $this->completePaymentResponse(
            $request,
            $order,
            $payment,
            'Test payment marked as successful.',
            'development_test_payment',
        );
    }

    public function verifyRazorpay(Request $request, Order $order, Payment $payment)
    {
        $validated = $request->validate([
            'razorpay_order_id' => ['required', 'string', 'max:255'],
            'razorpay_payment_id' => ['required', 'string', 'max:255'],
            'razorpay_signature' => ['required', 'string', 'max:512'],
        ]);

        if ((int) $order->user_id !== (int) $request->user()->id) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        if ((int) $payment->order_id !== (int) $order->id) {
            return response()->json(['message' => 'Payment does not belong to this order.'], 422);
        }

        if (! hash_equals((string) $payment->gateway_order_id, $validated['razorpay_order_id'])) {
            return response()->json(['message' => 'Razorpay order does not match this payment.'], 422);
        }

        if (Payment::query()
            ->where('gateway_payment_id', $validated['razorpay_payment_id'])
            ->whereKeyNot($payment->id)
            ->exists()) {
            return response()->json(['message' => 'This Razorpay payment has already been used.'], 422);
        }

        try {
            $this->razorpayGateway->verifySignature($validated);
        } catch (\Throwable $exception) {
            report($exception);

            return response()->json(['message' => 'Razorpay payment verification failed.'], 422);
        }

        return $this->completePaymentResponse(
            $request,
            $order,
            $payment,
            'Payment verified successfully. Project access has been updated.',
            'razorpay',
            $validated['razorpay_payment_id'],
        );
    }

    private function completePaymentResponse(
        Request $request,
        Order $order,
        Payment $payment,
        string $message,
        string $paymentMode,
        ?string $gatewayPaymentId = null,
    ) {
        if ((int) $order->user_id !== (int) $request->user()->id) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        if ((int) $payment->order_id !== (int) $order->id) {
            return response()->json(['message' => 'Payment does not belong to this order.'], 422);
        }

        try {
            $result = DB::transaction(function () use ($order, $payment, $gatewayPaymentId) {
                $lockedOrder = Order::query()->whereKey($order->id)
                    ->lockForUpdate()->with(['plan', 'project'])->firstOrFail();
                $lockedPayment = Payment::query()->whereKey($payment->id)
                    ->lockForUpdate()->firstOrFail();

                if ((int) $lockedPayment->order_id !== (int) $lockedOrder->id) {
                    throw new RuntimeException('Payment does not belong to this order.');
                }
                if ($lockedPayment->status === 'success') {
                    throw new RuntimeException('This payment is already successful.');
                }
                if ($lockedPayment->status !== 'created') {
                    throw new RuntimeException('Only created payments can be marked as successful.');
                }
                if ($lockedOrder->status === 'complete') {
                    throw new RuntimeException('This order is already complete.');
                }

                $isMiniProject = $this->isMiniProjectOrder($lockedOrder);
                if (! $isMiniProject) {
                    $this->validatePlanConfiguration($lockedOrder->plan);
                }

                $successfulPayments = $lockedOrder->payments()->where('status', 'success')->count();
                $expectedInstallment = $successfulPayments + 1;
                $totalInstallments = $isMiniProject ? 1 : (int) $lockedOrder->plan->installments;
                if ($expectedInstallment > $totalInstallments || (int) $lockedPayment->installment_no !== $expectedInstallment) {
                    throw new RuntimeException('Installments must be completed in order.');
                }

                $expectedAmount = $isMiniProject
                    ? (float) $lockedOrder->total
                    : $this->getInstallmentAmount($lockedOrder, $expectedInstallment);
                if (abs((float) $lockedPayment->amount - $expectedAmount) > 0.009) {
                    throw new RuntimeException('Payment amount does not match the expected installment amount.');
                }

                $unlockRule = $isMiniProject
                    ? $this->miniProjectUnlockRule($lockedOrder->project)
                    : $this->getUnlockRule($lockedOrder->plan, $expectedInstallment);

                $lockedPayment->update([
                    'status' => 'success',
                    'gateway_payment_id' => $gatewayPaymentId ?: $lockedPayment->gateway_payment_id,
                    'paid_at' => now(),
                ]);

                foreach ($unlockRule['stages'] as $stagePercent) {
                    $this->applyUserAccess((int) $lockedOrder->user_id, (int) $lockedOrder->project_id, (int) $stagePercent);
                }
                foreach ($unlockRule['bundles'] as $bundle) {
                    $this->applyBundleAccess((int) $lockedOrder->user_id, (int) $lockedOrder->project_id, $bundle);
                }

                $totalSuccessfulPayments = $lockedOrder->payments()->where('status', 'success')->count();
                $newOrderStatus = $totalSuccessfulPayments >= $totalInstallments ? 'complete' : 'partial';
                $lockedOrder->update(['status' => $newOrderStatus]);

                if ($newOrderStatus === 'complete' && $lockedOrder->coupon_id) {
                    $redemption = CouponRedemption::query()->where('order_id', $lockedOrder->id)->lockForUpdate()->first();
                    if ($redemption && $redemption->status === 'pending') {
                        $redemption->update(['status' => 'redeemed', 'redeemed_at' => now()]);
                        Coupon::query()->whereKey($lockedOrder->coupon_id)->increment('used_count');
                    }
                }

                $lockedOrder->load('user:id,group_id');
                $this->qualifyReferralForCompletedOrder($lockedOrder);
                $lockedOrder->refresh()->load(['plan', 'project']);

                return [
                    'payment' => $lockedPayment->fresh(),
                    'order' => $lockedOrder->load('payments'),
                    'unlock_rule' => $unlockRule,
                    'next_installment' => $newOrderStatus === 'complete' ? null : $totalSuccessfulPayments + 1,
                    'iot_shipment' => $isMiniProject ? null : $this->getIoTShipmentInfo($lockedOrder),
                ];
            });

            $this->referralRewardService->issueEligibleRewards();

            try {
                $order = $result['order']->loadMissing(['user:id,name,email', 'project:id,title']);
                if ($order->user?->email) {
                    Mail::to($order->user->email)->queue(new OrderConfirmed($order));
                }
            } catch (\Throwable $e) {
                report($e);
            }

            return response()->json([
                'message' => $message,
                'payment' => $result['payment'],
                'order' => $result['order'],
                'unlock_percent' => $this->highestStage($result['unlock_rule']['stages']),
                'unlock_stages' => $result['unlock_rule']['stages'],
                'unlock_bundles' => $result['unlock_rule']['bundles'],
                'next_installment' => $result['next_installment'],
                'iot_shipment' => $result['iot_shipment'],
                'payment_mode' => $paymentMode,
            ]);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }
    }

    private function qualifyReferralForCompletedOrder(Order $order): void
    {
        if ($order->status !== 'complete') {
            return;
        }

        $groupId = $order->user?->group_id;

        if (! $groupId) {
            return;
        }

        $referral = ReferralUse::query()
            ->where('referred_group_id', $groupId)
            ->where('status', 'pending')
            ->lockForUpdate()
            ->first();

        if (! $referral) {
            return;
        }

        if ((int) $referral->referrer_group_id === (int) $groupId) {
            return;
        }

        $referral->update([
            'status' => 'qualified',
            'qualified_order_id' => $order->id,
            'qualified_at' => now(),
        ]);
    }

    private function isMiniProjectOrder(Order $order): bool
    {
        return $order->plan_id === null
            && $order->project !== null
            && (string) $order->project->project_type === 'diploma_mini';
    }

    private function miniProjectUnlockRule(Project $project): array
    {
        if ((string) $project->project_type !== 'diploma_mini') {
            throw new RuntimeException('This order is not eligible for mini-project access.');
        }

        $configuredStages = DB::table('project_stages')
            ->where('project_id', $project->id)
            ->pluck('stage_percent')
            ->map(fn ($value) => (int) $value)
            ->all();

        $stages = array_values(array_unique(array_merge([20, 50, 75, 100], $configuredStages)));
        sort($stages);

        return ['stages' => $stages, 'bundles' => []];
    }

    private function validatePlanConfiguration(Plan $plan): void
    {
        $installments = (int) $plan->installments;

        if (! in_array($installments, [1, 2, 4], true)) {
            throw new RuntimeException(
                'Only one-time, two-installment, and four-installment plans are supported.'
            );
        }

        if (strtoupper(trim((string) $plan->code)) === 'ADDON') {
            throw new RuntimeException(
                'Document add-ons require a separate purchase flow.'
            );
        }

        $this->planUnlockMapService->validate(
            $plan->unlock_map,
            $installments
        );
    }

    private function getUnlockRule(
        Plan $plan,
        int $installmentNo
    ): array {
        return $this->planUnlockMapService->forInstallment(
            $plan->unlock_map,
            $installmentNo
        );
    }

    private function highestStage(array $stages): ?int
    {
        return $stages ? max($stages) : null;
    }

    private function getInstallmentAmount(
        Order $order,
        int $installmentNo
    ): float {
        $totalInstallments = (int) $order->plan->installments;

        if (
            $totalInstallments < 1
            || $installmentNo < 1
            || $installmentNo > $totalInstallments
        ) {
            throw new RuntimeException('Invalid installment number.');
        }

        $totalCents = (int) round((float) $order->total * 100);

        $isIoT = (bool) $order->project->is_iot;
        $planCode = strtoupper(trim((string) $order->plan->code));

        if ($isIoT && $planCode === 'B2' && $totalInstallments === 2) {
            $firstInstallmentCents = (int) round($totalCents * 0.75);

            $amountCents = $installmentNo === 1
                ? $firstInstallmentCents
                : $totalCents - $firstInstallmentCents;

            return $amountCents / 100;
        }

        $baseCents = intdiv($totalCents, $totalInstallments);

        $amountCents = $installmentNo === $totalInstallments
            ? $totalCents - ($baseCents * ($totalInstallments - 1))
            : $baseCents;

        return $amountCents / 100;
    }

    private function getIoTShipmentThreshold(Plan $plan): ?int
    {
        return match (strtoupper(trim((string) $plan->code))) {
            'A4', 'B2' => 75,
            'C1', 'D100' => 100,
            default => null,
        };
    }

    private function getIoTShipmentInfo(Order $order): ?array
    {
        if (! $order->project || ! $order->project->is_iot || ! $order->plan) {
            return null;
        }

        $threshold = $this->getIoTShipmentThreshold($order->plan);

        $successfulPayments = $order->payments()
            ->where('status', 'success');

        $successfulCount = (clone $successfulPayments)->count();
        $successfulAmount = (float) (clone $successfulPayments)->sum('amount');

        $total = (float) $order->total;
        $requiredAmount = $threshold !== null
            ? round($total * $threshold / 100, 2)
            : null;

        $planCode = strtoupper(trim((string) $order->plan->code));

        $requiredInstallments = match ($planCode) {
            'A4' => 3,
            'B2' => $order->project->is_iot ? 1 : null,
            'C1', 'D100' => 1,
            default => null,
        };

        $eligible = $threshold !== null
            && $requiredInstallments !== null
            && $total > 0
            && $successfulCount >= $requiredInstallments
            && $successfulAmount + 0.001 >= $requiredAmount;

        return [
            'eligible' => $eligible,
            'plan_code' => $planCode,
            'required_percentage' => $threshold,
            'required_amount' => $requiredAmount,
            'paid_amount' => round($successfulAmount, 2),
            'successful_installments' => $successfulCount,
            'required_installments' => $requiredInstallments,
            'kit_price' => $order->project->kit_price,
            'message' => $eligible
                ? 'The order meets the configured IoT shipment payment threshold. Submit a shipment request with the delivery address.'
                : 'The configured IoT shipment payment threshold has not yet been reached.',
        ];
    }

    private function applyUserAccess(
        int $userId,
        int $projectId,
        int $unlockPercent
    ): void {
        UserAccess::firstOrCreate([
            'user_id' => $userId,
            'project_id' => $projectId,
            'stage_percent' => $unlockPercent,
        ]);
    }

    private function applyBundleAccess(
        int $userId,
        int $projectId,
        string $bundle
    ): void {
        $exists = DB::table('user_bundle_access')
            ->where('user_id', $userId)
            ->where('project_id', $projectId)
            ->where('bundle', $bundle)
            ->exists();

        if (! $exists) {
            DB::table('user_bundle_access')->insert([
                'user_id' => $userId,
                'project_id' => $projectId,
                'bundle' => $bundle,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }
}
