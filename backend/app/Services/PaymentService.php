<?php

namespace App\Services;

use App\Models\Order;
use App\Models\Payment;
use App\Models\UserAccess;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class PaymentService
{
    public function __construct(
        private readonly PlanUnlockMapService $planUnlockMapService
    ) {}

    public function markAsSuccessful(Payment $payment): Payment
    {
        return DB::transaction(function () use ($payment) {
            $initialPayment = Payment::findOrFail($payment->id);

            $order = Order::where('id', $initialPayment->order_id)
                ->lockForUpdate()
                ->with('plan')
                ->firstOrFail();

            $payment = Payment::where('id', $initialPayment->id)
                ->lockForUpdate()
                ->firstOrFail();

            if ((int) $payment->order_id !== (int) $order->id) {
                throw new RuntimeException(
                    'Payment does not belong to this order.'
                );
            }

            if ($payment->status === 'success') {
                throw new RuntimeException(
                    'This payment is already successful.'
                );
            }

            if ($payment->status !== 'created') {
                throw new RuntimeException(
                    'Only created payments can be marked as successful.'
                );
            }

            if ($order->status === 'complete') {
                throw new RuntimeException(
                    'This order is already complete.'
                );
            }

            $plan = $order->plan;

            if (
                ! $plan ||
                ! in_array((int) $plan->installments, [1, 2, 4], true)
            ) {
                throw new RuntimeException(
                    'Invalid payment plan configuration.'
                );
            }

            $this->planUnlockMapService->validate(
                $plan->unlock_map,
                (int) $plan->installments
            );

            $successfulPayments = $order->payments()
                ->where('status', 'success')
                ->count();

            $expectedInstallment = $successfulPayments + 1;

            if ((int) $payment->installment_no !== $expectedInstallment) {
                throw new RuntimeException(
                    'Installments must be completed in order.'
                );
            }

            $expectedAmount = $this->getInstallmentAmount(
                (float) $order->total,
                (int) $plan->installments,
                $expectedInstallment
            );

            if (abs((float) $payment->amount - $expectedAmount) > 0.009) {
                throw new RuntimeException(
                    'Payment amount does not match the expected installment amount.'
                );
            }

            $unlockRule = $this->planUnlockMapService->forInstallment(
                $plan->unlock_map,
                $expectedInstallment
            );

            $payment->update([
                'status' => 'success',
                'paid_at' => now(),
            ]);

            foreach ($unlockRule['stages'] as $unlockPercent) {
                $this->applyStageAccess(
                    (int) $order->user_id,
                    (int) $order->project_id,
                    (int) $unlockPercent
                );
            }

            foreach ($unlockRule['bundles'] as $bundle) {
                $this->applyBundleAccess(
                    (int) $order->user_id,
                    (int) $order->project_id,
                    $bundle
                );
            }

            $totalSuccessfulPayments = $order->payments()
                ->where('status', 'success')
                ->count();

            $order->update([
                'status' => $totalSuccessfulPayments >= (int) $plan->installments
                    ? 'complete'
                    : 'partial',
            ]);

            return $payment->fresh();
        });
    }

    private function getInstallmentAmount(
        float $total,
        int $installments,
        int $installmentNo
    ): float {
        if (
            $installments < 1 ||
            $installmentNo < 1 ||
            $installmentNo > $installments
        ) {
            throw new RuntimeException('Invalid installment number.');
        }

        $totalCents = (int) round($total * 100);
        $baseCents = intdiv($totalCents, $installments);

        $amountCents = $installmentNo === $installments
            ? $totalCents - ($baseCents * ($installments - 1))
            : $baseCents;

        return $amountCents / 100;
    }

    private function applyStageAccess(
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
