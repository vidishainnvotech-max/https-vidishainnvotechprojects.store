<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Order;
use App\Models\Payment;
use App\Models\PaymentGatewaySetting;
use App\Models\Plan;
use App\Models\Project;
use App\Models\User;
use App\Services\RazorpayGateway;
use Database\Seeders\PlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use Tests\TestCase;

class RazorpayCheckoutTest extends TestCase
{
    use RefreshDatabase;

    public function test_configured_razorpay_checkout_creates_gateway_order_and_verifies_payment(): void
    {
        $this->seed(PlanSeeder::class);

        $student = User::factory()->create([
            'role' => 'student',
            'mobile' => '9000000201',
            'college_id' => '1',
        ]);
        $project = $this->createProject('standard');
        $plan = Plan::query()->where('code', 'C1')->firstOrFail();
        PaymentGatewaySetting::query()->create([
            'provider' => 'razorpay',
            'mode' => 'test',
            'test_key_id' => 'rzp_test_example123',
            'test_key_secret' => 'test-secret-value',
        ]);

        $orderResponse = $this->actingAs($student, 'sanctum')
            ->postJson('/api/orders', [
                'project_id' => $project->id,
                'plan_id' => $plan->id,
            ])
            ->assertCreated();

        $order = Order::query()->findOrFail($orderResponse->json('order.id'));
        $gateway = $this->mock(RazorpayGateway::class);
        $gateway->shouldReceive('activeConfiguration')
            ->once()
            ->andReturn([
                'mode' => 'test',
                'key_id' => 'rzp_test_example123',
                'key_secret' => 'test-secret-value',
            ]);
        $gateway->shouldReceive('createOrder')
            ->once()
            ->with(Mockery::on(fn (Payment $payment): bool => (int) $payment->order_id === $order->id))
            ->andReturn([
                'id' => 'order_gateway_123',
                'amount' => 1300000,
                'currency' => 'INR',
                'mode' => 'test',
                'key_id' => 'rzp_test_example123',
            ]);

        $paymentResponse = $this->actingAs($student, 'sanctum')
            ->postJson("/api/orders/{$order->id}/payments")
            ->assertCreated()
            ->assertJsonPath('payment_mode', 'razorpay')
            ->assertJsonPath('gateway.provider', 'razorpay')
            ->assertJsonPath('gateway.mode', 'test')
            ->assertJsonPath('gateway.order_id', 'order_gateway_123')
            ->assertJsonPath('gateway.key_id', 'rzp_test_example123');

        $payment = Payment::query()->findOrFail($paymentResponse->json('payment.id'));

        $this->assertSame('order_gateway_123', $payment->gateway_order_id);

        $gateway->shouldReceive('verifySignature')
            ->once()
            ->with([
                'razorpay_order_id' => 'order_gateway_123',
                'razorpay_payment_id' => 'pay_gateway_456',
                'razorpay_signature' => 'valid-signature',
            ]);

        $this->actingAs($student, 'sanctum')
            ->postJson(
                "/api/orders/{$order->id}/payments/{$payment->id}/verify-razorpay",
                [
                    'razorpay_order_id' => 'order_gateway_123',
                    'razorpay_payment_id' => 'pay_gateway_456',
                    'razorpay_signature' => 'valid-signature',
                ],
            )
            ->assertOk()
            ->assertJsonPath('payment_mode', 'razorpay')
            ->assertJsonPath('payment.status', 'success')
            ->assertJsonPath('order.status', 'complete');

        $this->assertDatabaseHas('payments', [
            'id' => $payment->id,
            'gateway_order_id' => 'order_gateway_123',
            'gateway_payment_id' => 'pay_gateway_456',
            'status' => 'success',
        ]);
    }

    public function test_returns_422_when_gateway_order_does_not_match_internal_payment(): void
    {
        $student = User::factory()->create([
            'role' => 'student',
            'mobile' => '9000000202',
            'college_id' => '1',
        ]);
        $project = $this->createProject('diploma_mini');
        $order = Order::query()->create([
            'user_id' => $student->id,
            'project_id' => $project->id,
            'plan_id' => null,
            'base_price' => 1000,
            'total' => 1000,
            'status' => 'pending',
        ]);
        $payment = Payment::query()->create([
            'order_id' => $order->id,
            'installment_no' => 1,
            'amount' => 1000,
            'gateway_order_id' => 'order_expected',
            'status' => 'created',
        ]);

        $this->actingAs($student, 'sanctum')
            ->postJson(
                "/api/orders/{$order->id}/payments/{$payment->id}/verify-razorpay",
                [
                    'razorpay_order_id' => 'order_wrong',
                    'razorpay_payment_id' => 'pay_gateway_456',
                    'razorpay_signature' => 'invalid-signature',
                ],
            )
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Razorpay order does not match this payment.');

        $this->assertDatabaseHas('payments', [
            'id' => $payment->id,
            'status' => 'created',
            'gateway_payment_id' => null,
        ]);
    }

    private function createProject(string $projectType): Project
    {
        $category = Category::query()->create([
            'name' => 'Razorpay Projects',
            'slug' => 'razorpay-projects',
        ]);

        return Project::query()->create([
            'category_id' => $category->id,
            'title' => 'Razorpay Checkout Project',
            'slug' => 'razorpay-checkout-project',
            'abstract' => 'Project used to verify Razorpay checkout.',
            'project_type' => $projectType,
            'offer_price' => 13000,
            'is_iot' => false,
            'is_active' => true,
        ]);
    }
}
