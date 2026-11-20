<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\College;
use App\Models\Coupon;
use App\Models\Group;
use App\Models\Order;
use App\Models\Plan;
use App\Models\Project;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CouponOrderSecurityTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private Project $project;

    private Project $otherProject;

    private Plan $plan;

    protected function setUp(): void
    {
        parent::setUp();

        $college = College::create([
            'name' => 'Order Coupon College '.uniqid(),
        ]);

        $group = Group::create([
            'college_id' => $college->id,
            'member_count' => 1,
            'pincode' => '422001',
            'whatsapp' => '9000000000',
            'guide_name' => 'Order Test Guide',
            'guide_mobile' => '9000000001',
        ]);

        $this->user = User::create([
            'name' => 'Coupon Order Student',
            'email' => 'coupon-order-'.uniqid().'@example.com',
            'mobile' => '91'.random_int(100000000, 999999999),
            'college_id' => $college->id,
            'group_id' => $group->id,
            'password' => 'Password123!',
            'role' => 'student',
            'email_verified_at' => now(),
        ]);

        $category = Category::create([
            'name' => 'Order Coupon Category '.uniqid(),
            'slug' => 'order-coupon-category-'.uniqid(),
        ]);

        $this->project = $this->createProject(
            $category->id,
            'first'
        );

        $this->otherProject = $this->createProject(
            $category->id,
            'second'
        );

        $this->plan = Plan::create([
            'name' => 'Coupon Security Plan',
            'code' => 'A4',
            'description' => 'Test plan',
            'price' => 15000,
            'installments' => 4,
            'unlock_map' => [
                20,
                50,
                75,
                100,
            ],
            'is_active' => true,
        ]);
    }

    private function createProject(
        int $categoryId,
        string $suffix
    ): Project {
        return Project::create([
            'category_id' => $categoryId,
            'title' => 'Coupon Order Project '.$suffix,
            'slug' => 'coupon-order-'.$suffix.'-'.uniqid(),
            'abstract' => 'Project for coupon order tests.',
            'is_iot' => false,
        ]);
    }

    private function createCoupon(array $overrides = []): Coupon
    {
        return Coupon::create(array_merge([
            'code' => 'ORDER'.strtoupper(uniqid()),
            'type' => 'percentage',
            'value' => 10,
            'scope' => 'site_wide',
            'project_id' => null,
            'source' => 'admin',
            'owner_group_id' => null,
            'created_by' => null,
            'valid_from' => now()->subDay(),
            'valid_until' => now()->addDay(),
            'max_uses' => 5,
            'used_count' => 0,
            'is_active' => true,
        ], $overrides));
    }

    private function createOrderWithCoupon(
        Coupon $coupon,
        ?Project $project = null
    ) {
        return $this->actingAs($this->user, 'sanctum')
            ->postJson('/api/orders', [
                'project_id' => ($project ?? $this->project)->id,
                'plan_id' => $this->plan->id,
                'coupon_code' => $coupon->code,
            ]);
    }

    private function completeOrder(Order $order): void
    {
        for ($installment = 1; $installment <= 4; $installment++) {
            $paymentResponse = $this->actingAs(
                $this->user,
                'sanctum'
            )->postJson(
                "/api/orders/{$order->id}/payments"
            );

            $paymentResponse->assertCreated();

            $paymentId = $paymentResponse->json('payment.id');

            $this->assertNotNull(
                $paymentId,
                'The payment API should return a payment ID.'
            );

            $this->actingAs($this->user, 'sanctum')
                ->postJson(
                    "/api/orders/{$order->id}/payments/{$paymentId}/test-success"
                )
                ->assertSuccessful();
        }
    }

    public function test_expired_coupon_is_rejected_by_order_api(): void
    {
        $coupon = $this->createCoupon([
            'valid_until' => now()->subDay(),
        ]);

        $this->createOrderWithCoupon($coupon)
            ->assertUnprocessable();

        $this->assertDatabaseCount('orders', 0);
        $this->assertSame(0, (int) $coupon->fresh()->used_count);
    }

    public function test_inactive_coupon_is_rejected_by_order_api(): void
    {
        $coupon = $this->createCoupon([
            'is_active' => false,
        ]);

        $this->createOrderWithCoupon($coupon)
            ->assertUnprocessable();

        $this->assertDatabaseCount('orders', 0);
        $this->assertSame(0, (int) $coupon->fresh()->used_count);
    }

    public function test_project_coupon_is_rejected_for_another_project(): void
    {
        $coupon = $this->createCoupon([
            'scope' => 'project',
            'project_id' => $this->project->id,
        ]);

        $this->createOrderWithCoupon(
            $coupon,
            $this->otherProject
        )->assertUnprocessable();

        $this->assertDatabaseCount('orders', 0);
    }

    public function test_referral_reward_coupon_is_rejected_for_another_group(): void
    {
        $otherGroup = Group::create([
            'college_id' => $this->user->college_id,
            'member_count' => 1,
            'pincode' => '422002',
            'whatsapp' => '9000000010',
            'guide_name' => 'Another Guide',
            'guide_mobile' => '9000000011',
        ]);

        $coupon = $this->createCoupon([
            'source' => 'referral_reward',
            'owner_group_id' => $otherGroup->id,
            'max_uses' => 1,
        ]);

        $this->createOrderWithCoupon($coupon)
            ->assertUnprocessable();

        $this->assertDatabaseCount('orders', 0);
    }

    public function test_coupon_at_usage_limit_is_rejected_by_order_api(): void
    {
        $coupon = $this->createCoupon([
            'max_uses' => 1,
            'used_count' => 1,
        ]);

        $this->createOrderWithCoupon($coupon)
            ->assertUnprocessable();

        $this->assertDatabaseCount('orders', 0);
    }

    public function test_valid_coupon_creates_order_with_discount(): void
    {
        $coupon = $this->createCoupon([
            'code' => 'VALID10',
            'type' => 'percentage',
            'value' => 10,
        ]);

        $response = $this->createOrderWithCoupon($coupon);

        $response->assertCreated();

        $orderId = $response->json('order.id');

        $this->assertNotNull($orderId);

        $this->assertDatabaseHas('orders', [
            'id' => $orderId,
            'user_id' => $this->user->id,
            'project_id' => $this->project->id,
            'plan_id' => $this->plan->id,
            'base_price' => 15000.00,
            'total' => 13500.00,
            'coupon_id' => $coupon->id,
            'discount_amount' => 1500.00,
        ]);

        $this->assertDatabaseHas('coupon_redemptions', [
            'coupon_id' => $coupon->id,
            'order_id' => $orderId,
            'discount_amount' => 1500.00,
            'status' => 'pending',
        ]);

        $this->assertSame(
            0,
            (int) $coupon->fresh()->used_count,
            'Creating an order must not count as a completed coupon use.'
        );
    }

    public function test_pending_order_does_not_increment_coupon_usage(): void
    {
        $coupon = $this->createCoupon([
            'max_uses' => 1,
        ]);

        $this->createOrderWithCoupon($coupon)
            ->assertCreated();

        $this->assertSame(
            0,
            (int) $coupon->fresh()->used_count
        );

        $this->assertDatabaseHas('coupon_redemptions', [
            'coupon_id' => $coupon->id,
            'status' => 'pending',
        ]);
    }

    public function test_coupon_usage_increments_only_when_order_completes(): void
    {
        $coupon = $this->createCoupon([
            'code' => 'COMPLETE10',
            'max_uses' => 1,
        ]);

        $response = $this->createOrderWithCoupon($coupon)
            ->assertCreated();

        $order = Order::findOrFail(
            $response->json('order.id')
        );

        $this->assertSame(
            0,
            (int) $coupon->fresh()->used_count
        );

        $this->completeOrder($order);

        $this->assertSame(
            1,
            (int) $coupon->fresh()->used_count
        );

        $this->assertDatabaseHas('coupon_redemptions', [
            'coupon_id' => $coupon->id,
            'order_id' => $order->id,
            'status' => 'redeemed',
        ]);
    }

    public function test_repeating_payment_completion_does_not_increment_coupon_usage_twice(): void
    {
        $coupon = $this->createCoupon([
            'code' => 'ONCE10',
            'max_uses' => 1,
        ]);

        $response = $this->createOrderWithCoupon($coupon)
            ->assertCreated();

        $order = Order::findOrFail(
            $response->json('order.id')
        );

        $lastPaymentId = null;

        for ($installment = 1; $installment <= 4; $installment++) {
            $paymentResponse = $this->actingAs(
                $this->user,
                'sanctum'
            )->postJson(
                "/api/orders/{$order->id}/payments"
            );

            $paymentResponse->assertCreated();

            $lastPaymentId = $paymentResponse->json('payment.id');

            $this->actingAs($this->user, 'sanctum')
                ->postJson(
                    "/api/orders/{$order->id}/payments/{$lastPaymentId}/test-success"
                )
                ->assertSuccessful();
        }

        $this->assertSame(
            1,
            (int) $coupon->fresh()->used_count
        );

        $this->actingAs($this->user, 'sanctum')
            ->postJson(
                "/api/orders/{$order->id}/payments/{$lastPaymentId}/test-success"
            )
            ->assertUnprocessable();

        $this->assertSame(
            1,
            (int) $coupon->fresh()->used_count
        );

        $this->assertDatabaseHas('coupon_redemptions', [
            'coupon_id' => $coupon->id,
            'order_id' => $order->id,
            'status' => 'redeemed',
        ]);
    }

    public function test_pending_reservation_prevents_coupon_usage_limit_from_being_exceeded(): void
    {
        $coupon = $this->createCoupon([
            'code' => 'LIMITONE',
            'max_uses' => 1,
        ]);

        $this->createOrderWithCoupon($coupon)
            ->assertCreated();

        $this->createOrderWithCoupon($coupon, $this->otherProject)
            ->assertUnprocessable();

        $this->assertSame(
            0,
            (int) $coupon->fresh()->used_count,
            'Pending reservations must not increment completed usage.'
        );

        $this->assertDatabaseCount('orders', 1);

        $this->assertDatabaseCount('coupon_redemptions', 1);
    }
}
