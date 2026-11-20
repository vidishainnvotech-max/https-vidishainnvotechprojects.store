<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdatePaymentGatewaySettingRequest;
use App\Models\PaymentGatewaySetting;
use Illuminate\Http\JsonResponse;

class PaymentGatewaySettingController extends Controller
{
    public function show(): JsonResponse
    {
        return response()->json([
            'gateway' => $this->serializeSettings($this->settings()),
        ]);
    }

    public function update(UpdatePaymentGatewaySettingRequest $request): JsonResponse
    {
        $settings = $this->settings();
        $validated = $request->validated();

        $attributes = [
            'mode' => $validated['mode'],
            'updated_by' => $request->user()->id,
        ];

        foreach (['test_key_id', 'test_key_secret', 'live_key_id', 'live_key_secret'] as $field) {
            if (isset($validated[$field]) && trim($validated[$field]) !== '') {
                $attributes[$field] = trim($validated[$field]);
            }
        }

        $settings->update($attributes);

        return response()->json([
            'message' => 'Razorpay settings saved successfully.',
            'gateway' => $this->serializeSettings($settings->fresh()),
        ]);
    }

    private function settings(): PaymentGatewaySetting
    {
        return PaymentGatewaySetting::query()->firstOrCreate(
            ['provider' => 'razorpay'],
            ['mode' => 'test'],
        );
    }

    private function serializeSettings(PaymentGatewaySetting $settings): array
    {
        return [
            'provider' => $settings->provider,
            'mode' => $settings->mode,
            'configured' => $settings->activeCredentials() !== null,
            'test' => [
                'key_id' => $settings->test_key_id,
                'key_secret_set' => filled($settings->test_key_secret),
                'configured' => $settings->credentialsFor('test') !== null,
            ],
            'live' => [
                'key_id' => $settings->live_key_id,
                'key_secret_set' => filled($settings->live_key_secret),
                'configured' => $settings->credentialsFor('live') !== null,
            ],
            'updated_at' => $settings->updated_at,
        ];
    }
}
