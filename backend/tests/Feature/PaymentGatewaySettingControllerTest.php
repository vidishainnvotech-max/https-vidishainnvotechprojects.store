<?php

namespace Tests\Feature;

use App\Models\PaymentGatewaySetting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class PaymentGatewaySettingControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_returns_401_when_admin_gateway_settings_are_requested_without_authentication(): void
    {
        $this->getJson('/api/admin/payment-gateway')->assertUnauthorized();
    }

    public function test_returns_403_when_student_requests_admin_gateway_settings(): void
    {
        $student = User::factory()->create([
            'role' => 'student',
            'mobile' => '9000000101',
            'college_id' => '1',
        ]);

        $this->actingAs($student, 'sanctum')
            ->getJson('/api/admin/payment-gateway')
            ->assertForbidden();
    }

    public function test_admin_can_save_encrypted_credentials_without_exposing_secrets(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
            'mobile' => '9000000102',
            'college_id' => '1',
        ]);

        $response = $this->actingAs($admin, 'sanctum')
            ->putJson('/api/admin/payment-gateway', [
                'mode' => 'test',
                'test_key_id' => 'rzp_test_example123',
                'test_key_secret' => 'test-secret-value',
                'live_key_id' => 'rzp_live_example456',
                'live_key_secret' => 'live-secret-value',
            ])
            ->assertOk()
            ->assertJsonPath('gateway.mode', 'test')
            ->assertJsonPath('gateway.configured', true)
            ->assertJsonPath('gateway.test.key_secret_set', true)
            ->assertJsonPath('gateway.live.key_secret_set', true);

        $settings = PaymentGatewaySetting::query()->firstOrFail();

        $this->assertSame('rzp_test_example123', $settings->test_key_id);
        $this->assertSame('test-secret-value', $settings->test_key_secret);
        $this->assertSame('rzp_live_example456', $settings->live_key_id);
        $this->assertSame('live-secret-value', $settings->live_key_secret);
        $this->assertSame($admin->id, $settings->updated_by);

        $rawSettings = DB::table('payment_gateway_settings')->first();

        $this->assertNotSame('test-secret-value', $rawSettings->test_key_secret);
        $this->assertNotSame('live-secret-value', $rawSettings->live_key_secret);
        $this->assertStringNotContainsString('test-secret-value', $response->getContent());
        $this->assertStringNotContainsString('live-secret-value', $response->getContent());
    }

    public function test_admin_can_switch_to_live_mode_without_reentering_credentials(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
            'mobile' => '9000000103',
            'college_id' => '1',
        ]);
        PaymentGatewaySetting::query()->create([
            'provider' => 'razorpay',
            'mode' => 'test',
            'test_key_id' => 'rzp_test_example123',
            'test_key_secret' => 'test-secret-value',
            'live_key_id' => 'rzp_live_example456',
            'live_key_secret' => 'live-secret-value',
        ]);

        $this->actingAs($admin, 'sanctum')
            ->putJson('/api/admin/payment-gateway', ['mode' => 'live'])
            ->assertOk()
            ->assertJsonPath('gateway.mode', 'live')
            ->assertJsonPath('gateway.configured', true);

        $settings = PaymentGatewaySetting::query()->firstOrFail();

        $this->assertSame('test-secret-value', $settings->test_key_secret);
        $this->assertSame('live-secret-value', $settings->live_key_secret);
    }
}
