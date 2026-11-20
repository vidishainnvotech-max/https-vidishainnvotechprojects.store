<?php

namespace App\Services;

use App\Models\Payment;
use App\Models\PaymentGatewaySetting;
use Razorpay\Api\Api;
use RuntimeException;

class RazorpayGateway
{
    public function settings(): ?PaymentGatewaySetting
    {
        return PaymentGatewaySetting::query()
            ->where('provider', 'razorpay')
            ->first();
    }

    public function activeConfiguration(): ?array
    {
        $settings = $this->settings();
        $credentials = $settings?->activeCredentials();

        if (! $settings || ! $credentials) {
            return null;
        }

        return [
            'mode' => $settings->mode,
            'key_id' => $credentials['key_id'],
            'key_secret' => $credentials['key_secret'],
        ];
    }

    public function createOrder(Payment $payment): array
    {
        $configuration = $this->activeConfiguration();

        if (! $configuration) {
            throw new RuntimeException('Razorpay is not configured for the selected mode.');
        }

        $gatewayOrder = $this->api($configuration)->order->create([
            'receipt' => "payment_{$payment->id}",
            'amount' => (int) round((float) $payment->amount * 100),
            'currency' => 'INR',
            'notes' => [
                'payment_id' => (string) $payment->id,
                'order_id' => (string) $payment->order_id,
                'installment_no' => (string) $payment->installment_no,
            ],
        ]);

        return [
            'id' => (string) $gatewayOrder['id'],
            'amount' => (int) $gatewayOrder['amount'],
            'currency' => (string) $gatewayOrder['currency'],
            'mode' => $configuration['mode'],
            'key_id' => $configuration['key_id'],
        ];
    }

    public function verifySignature(array $attributes): void
    {
        $settings = $this->settings();

        if (! $settings) {
            throw new RuntimeException('Razorpay is not configured for the selected mode.');
        }

        $modes = array_values(array_unique([$settings->mode, 'test', 'live']));
        $lastException = null;

        foreach ($modes as $mode) {
            $credentials = $settings->credentialsFor($mode);

            if (! $credentials) {
                continue;
            }

            try {
                $this->api($credentials)->utility->verifyPaymentSignature($attributes);

                return;
            } catch (\Throwable $exception) {
                $lastException = $exception;
            }
        }

        throw new RuntimeException(
            'Razorpay payment signature is invalid.',
            previous: $lastException,
        );
    }

    private function api(array $configuration): Api
    {
        return new Api($configuration['key_id'], $configuration['key_secret']);
    }
}
