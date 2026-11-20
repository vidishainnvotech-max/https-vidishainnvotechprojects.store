<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Models\IotShipment;
use App\Models\Order;
use App\Models\Project;
use App\Services\AdminNotificationService;
use App\Services\PlanUnlockMapService;
use App\Services\ShipmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class IotShipmentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $shipments = IotShipment::query()
            ->where('user_id', $request->user()->id)
            ->with([
                'project:id,title',
                'order:id,status,plan_id',
                'order.plan:id,name,code,installments',
                'events.updatedBy:id,name',
            ])
            ->latest()
            ->get();

        return response()->json([
            'success' => true,
            'data' => $shipments,
        ]);
    }

    public function store(
        Request $request,
        Project $project,
        PlanUnlockMapService $planUnlockMapService,
        ShipmentService $shipmentService,
    ): JsonResponse {
        $validated = $request->validate([
            'order_id' => ['required', 'integer', 'exists:orders,id'],
            'recipient_name' => ['required', 'string', 'max:150'],
            'recipient_phone' => ['required', 'string', 'max:20'],
            'shipping_address' => ['required', 'string', 'max:2000'],
            'city' => ['required', 'string', 'max:100'],
            'state' => ['required', 'string', 'max:100'],
            'postal_code' => ['required', 'string', 'max:20'],
            'country' => ['sometimes', 'required', 'string', 'max:100'],
        ]);

        if (! $project->is_iot) {
            return response()->json([
                'success' => false,
                'message' => 'This project does not have an IoT kit.',
            ], 422);
        }

        if ($project->kit_price === null || (float) $project->kit_price <= 0) {
            return response()->json([
                'success' => false,
                'message' => 'The IoT kit price has not been configured for this project.',
            ], 422);
        }

        $order = Order::query()
            ->with('plan')
            ->whereKey($validated['order_id'])
            ->where('user_id', $request->user()->id)
            ->where('project_id', $project->id)
            ->first();

        if (! $order || ! $order->plan) {
            return response()->json([
                'success' => false,
                'message' => 'A valid order and payment plan for this project were not found.',
            ], 422);
        }

        $plan = $order->plan;
        $installments = (int) $plan->installments;
        $planCode = strtoupper(trim((string) $plan->code));

        try {
            $planUnlockMapService->validate(
                $plan->unlock_map,
                $installments
            );
        } catch (\RuntimeException $exception) {
            return response()->json([
                'success' => false,
                'message' => 'The payment plan unlock configuration is invalid.',
            ], 422);
        }

        if (! in_array($installments, [1, 2, 4], true)) {
            return response()->json([
                'success' => false,
                'message' => 'The payment plan configuration is invalid.',
            ], 422);
        }

        if (! in_array($order->status, ['partial', 'complete'], true)) {
            return response()->json([
                'success' => false,
                'message' => 'The order is not eligible for shipment.',
            ], 422);
        }

        $successfulPayments = $order->payments()
            ->where('status', 'success')
            ->count();

        $successfulAmount = (float) $order->payments()
            ->where('status', 'success')
            ->sum('amount');

        if ($successfulPayments < 1 || $successfulAmount <= 0) {
            return response()->json([
                'success' => false,
                'message' => 'At least one successful payment is required.',
            ], 422);
        }

        $requiredThreshold = match ($planCode) {
            'A4' => 75,
            'B2' => 75,
            'C1', 'D100' => 100,
            default => null,
        };

        if ($requiredThreshold === null) {
            return response()->json([
                'success' => false,
                'message' => 'IoT shipment eligibility is not configured for this plan.',
            ], 422);
        }

        $orderTotal = (float) $order->total;

        if ($orderTotal <= 0) {
            return response()->json([
                'success' => false,
                'message' => 'The order total is invalid.',
            ], 422);
        }

        $requiredAmount = round(
            $orderTotal * ($requiredThreshold / 100),
            2
        );

        if ($successfulAmount + 0.001 < $requiredAmount) {
            return response()->json([
                'success' => false,
                'message' => sprintf(
                    'IoT kit shipment requires at least %d%% of the plan price to be paid successfully.',
                    $requiredThreshold
                ),
                'data' => [
                    'required_percentage' => $requiredThreshold,
                    'required_amount' => $requiredAmount,
                    'paid_amount' => round($successfulAmount, 2),
                ],
            ], 422);
        }

        if ($planCode === 'A4' && $successfulPayments < 3) {
            return response()->json([
                'success' => false,
                'message' => 'The A4 IoT kit becomes eligible after the third successful installment.',
            ], 422);
        }

        if ($planCode === 'C1' && $successfulPayments < 1) {
            return response()->json([
                'success' => false,
                'message' => 'The C1 IoT kit requires a successful one-time payment.',
            ], 422);
        }

        $shipment = DB::transaction(function () use (
            $request,
            $project,
            $order,
            $validated,
            $shipmentService,
        ) {
            $lockedOrder = Order::query()
                ->whereKey($order->id)
                ->lockForUpdate()
                ->firstOrFail();

            if (
                (int) $lockedOrder->user_id !== (int) $request->user()->id
                || (int) $lockedOrder->project_id !== (int) $project->id
            ) {
                throw ValidationException::withMessages([
                    'order_id' => [
                        'The order does not belong to this student and project.',
                    ],
                ]);
            }

            $existingShipment = IotShipment::query()
                ->where('order_id', $lockedOrder->id)
                ->exists();

            if ($existingShipment) {
                throw ValidationException::withMessages([
                    'order_id' => [
                        'A shipment request already exists for this order.',
                    ],
                ]);
            }

            $shipment = $shipmentService->createForOrder(
                $lockedOrder->loadMissing(['project', 'user']),
                [
                    ...$validated,
                    'quantity' => 1,
                ],
            );

            AdminNotificationService::notifyAdmins(
                'iot_shipment',
                "New IoT Shipment {$shipment->shipment_number}",
                "A student has requested an IoT kit shipment for {$project->title}.",
                '/admin/shipments'
            );

            return $shipment;
        });

        return response()->json([
            'success' => true,
            'message' => 'IoT kit shipment request created successfully.',
            'data' => $shipment->load([
                'project:id,title',
                'order:id,status,plan_id',
                'order.plan:id,name,code,installments',
                'events.updatedBy:id,name',
            ]),
        ], 201);
    }

    public function show(
        Request $request,
        IotShipment $shipment
    ): JsonResponse {
        if ((int) $shipment->user_id !== (int) $request->user()->id) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized.',
            ], 403);
        }

        return response()->json([
            'success' => true,
            'data' => $shipment->load([
                'project:id,title',
                'order:id,status,plan_id',
                'order.plan:id,name,code,installments',
                'events.updatedBy:id,name',
            ]),
        ]);
    }
}
