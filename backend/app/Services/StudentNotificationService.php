<?php

namespace App\Services;

use App\Models\Order;
use App\Models\StudentNotification;
use App\Models\User;
use Illuminate\Support\Str;

class StudentNotificationService
{
    public function syncFor(User $user): void
    {
        $orders = Order::query()
            ->where('user_id', $user->id)
            ->with([
                'project:id,title',
                'plan:id,name,installments',
                'payments:id,order_id,installment_no,amount,status,paid_at,created_at',
                'shipment.events:id,iot_shipment_id,status,title,description,occurred_at',
            ])
            ->latest('id')
            ->limit(50)
            ->get();

        foreach ($orders as $order) {
            $projectTitle = $order->project?->title ?: 'your project';
            $orderUrl = "/student/orders/{$order->id}";

            $this->createOnce($user, [
                'notification_key' => "order:{$order->id}:created",
                'type' => 'order',
                'title' => 'Order created',
                'message' => "Order #{$order->id} for {$projectTitle} was created successfully.",
                'url' => $orderUrl,
                'occurred_at' => $order->created_at,
            ]);

            $successfulPayments = $order->payments
                ->where('status', 'success')
                ->sortBy('installment_no')
                ->values();

            foreach ($successfulPayments as $payment) {
                $this->resolvePendingInstallment($user, $order->id, (int) $payment->installment_no);
                $this->createOnce($user, [
                    'notification_key' => "order:{$order->id}:payment:{$payment->id}:success",
                    'type' => 'payment',
                    'title' => 'Payment received',
                    'message' => 'Installment '.$payment->installment_no.' for '.$projectTitle.' was successful. Your eligible project content is now unlocked.',
                    'url' => $orderUrl,
                    'occurred_at' => $payment->paid_at ?: $payment->created_at,
                ]);
            }

            $totalInstallments = max(1, (int) ($order->plan?->installments ?: 1));
            if ($order->status === 'complete') {
                StudentNotification::query()
                    ->where('user_id', $user->id)
                    ->where('notification_key', 'like', "order:{$order->id}:installment:%:pending")
                    ->whereNull('read_at')
                    ->update(['read_at' => now()]);

                $this->createOnce($user, [
                    'notification_key' => "order:{$order->id}:complete",
                    'type' => 'completed',
                    'title' => 'Project fully unlocked',
                    'message' => "All required payments for {$projectTitle} are complete. Your full project access is ready.",
                    'url' => $orderUrl,
                    'occurred_at' => $successfulPayments->last()?->paid_at ?: $order->updated_at,
                ]);
            } else {
                $nextInstallment = min($successfulPayments->count() + 1, $totalInstallments);
                $this->createOnce($user, [
                    'notification_key' => "order:{$order->id}:installment:{$nextInstallment}:pending",
                    'type' => 'installment',
                    'title' => "Installment {$nextInstallment} pending",
                    'message' => "Complete installment {$nextInstallment} for {$projectTitle} to unlock the next available stage.",
                    'url' => $orderUrl,
                    'occurred_at' => $order->updated_at,
                ]);
            }

            foreach ($order->shipment?->events ?? [] as $event) {
                $eventTitle = $event->title ?: Str::headline((string) $event->status);
                $this->createOnce($user, [
                    'notification_key' => "shipment:{$order->shipment->id}:event:{$event->id}",
                    'type' => 'shipment',
                    'title' => $eventTitle,
                    'message' => $event->description ?: "Your {$projectTitle} delivery status was updated to {$eventTitle}.",
                    'url' => $orderUrl,
                    'occurred_at' => $event->occurred_at,
                ]);
            }
        }
    }

    private function createOnce(User $user, array $notification): void
    {
        StudentNotification::firstOrCreate(
            [
                'user_id' => $user->id,
                'notification_key' => $notification['notification_key'],
            ],
            $notification
        );
    }

    private function resolvePendingInstallment(User $user, int $orderId, int $installment): void
    {
        StudentNotification::query()
            ->where('user_id', $user->id)
            ->where('notification_key', "order:{$orderId}:installment:{$installment}:pending")
            ->whereNull('read_at')
            ->update(['read_at' => now()]);
    }
}
