<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\College;
use App\Models\Group;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Plan;
use App\Models\Project;
use App\Models\ReferralCode;
use App\Models\ReferralUse;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReferralQualificationTest extends TestCase
{
    use RefreshDatabase;

    private User $referrerUser;

    private User $referredUser;

    private Group $referrerGroup;

    private Group $referredGroup;

    private Project $project;

    private Plan $plan;

    protected function setUp(): void
    {
        parent::setUp();

        $college = College::create([
            'name' => 'Referral Qualification College '.uniqid(),
        ]);

        $this->referrerGroup = $this->createGroup($college->id, 'Referrer');
        $this->referredGroup = $this->createGroup($college->id, 'Referred');

        $this->referrerUser = $this->createUser(
            $college->id,
            $this->referrerGroup->id,
            'referrer'
        );

        $this->referredUser = $this->createUser(
            $college->id,
            $this->referredGroup->id,
            'referred'
        );

        $category = Category::create([
            'name' => 'Referral Category '.uniqid(),
            'slug' => 'referral-category-'.uniqid(),
        ]);

        $this->project = Project::create([
            'category_id' => $category->id,
            'title' => 'Referral Qualification Project',
            'slug' => 'referral-qualification-'.uniqid(),
            'abstract' => 'Project for referral qualification tests.',
            'is_iot' => false,
        ]);

        $this->plan = Plan::create([
            'name' => 'Referral Qualification Plan',
            'code' => 'A4',
            'description' => 'Four-installment test plan',
            'price' => 15000,
            'installments' => 4,
            'unlock_map' => [20, 50, 75, 100],
            'is_active' => true,
        ]);
    }

    private function createGroup(int $collegeId, string $suffix): Group
    {
        return Group::create([
            'college_id' => $collegeId,
            'member_count' => 1,
            'pincode' => '422001',
            'whatsapp' => '9'.random_int(100000000, 999999999),
            'guide_name' => $suffix.' Guide',
            'guide_mobile' => '8'.random_int(100000000, 999999999),
        ]);
    }

    private function createUser(
        int $collegeId,
        int $groupId,
        string $suffix
    ): User {
        return User::create([
            'name' => ucfirst($suffix).' Student',
            'email' => $suffix.'-'.uniqid().'@example.com',
            'mobile' => '91'.random_int(100000000, 999999999),
            'college_id' => $collegeId,
            'group_id' => $groupId,
            'password' => 'Password123!',
            'role' => 'student',
            'email_verified_at' => now(),
        ]);
    }

    private function createReferral(
        Group $referrer,
        Group $referred,
        string $status = 'pending'
    ): ReferralUse {
        $code = ReferralCode::create([
            'group_id' => $referrer->id,
            'code' => 'REF'.strtoupper(uniqid()),
            'is_active' => true,
        ]);

        return ReferralUse::create([
            'referral_code_id' => $code->id,
            'referrer_group_id' => $referrer->id,
            'referred_group_id' => $referred->id,
            'qualified_order_id' => null,
            'status' => $status,
            'qualified_at' => $status === 'qualified' ? now() : null,
        ]);
    }

    private function createOrder(): Order
    {
        return Order::create([
            'user_id' => $this->referredUser->id,
            'project_id' => $this->project->id,
            'plan_id' => $this->plan->id,
            'total' => 15000,
            'status' => 'pending',
            'coupon_id' => null,
            'discount_amount' => 0,
        ]);
    }

    private function completeNextInstallment(Order $order): Payment
    {
        $createResponse = $this->actingAs(
            $this->referredUser,
            'sanctum'
        )->postJson("/api/orders/{$order->id}/payments");

        $createResponse->assertCreated();

        $paymentId = $createResponse->json('payment.id');

        $this->assertNotNull($paymentId);

        $payment = Payment::findOrFail($paymentId);

        $this->actingAs($this->referredUser, 'sanctum')
            ->postJson(
                "/api/orders/{$order->id}/payments/{$payment->id}/test-success"
            )
            ->assertSuccessful();

        return $payment->fresh();
    }

    public function test_referral_remains_pending_until_order_is_complete(): void
    {
        $referral = $this->createReferral(
            $this->referrerGroup,
            $this->referredGroup
        );

        $order = $this->createOrder();

        $this->completeNextInstallment($order);

        $this->assertSame(
            'pending',
            $referral->fresh()->status
        );

        $this->assertNull($referral->fresh()->qualified_order_id);

        $this->completeNextInstallment($order);
        $this->completeNextInstallment($order);

        $this->assertSame(
            'pending',
            $referral->fresh()->status
        );

        $this->assertNull($referral->fresh()->qualified_order_id);
    }

    public function test_referral_qualifies_after_all_installments_complete(): void
    {
        $referral = $this->createReferral(
            $this->referrerGroup,
            $this->referredGroup
        );

        $order = $this->createOrder();

        for ($i = 0; $i < 4; $i++) {
            $this->completeNextInstallment($order);
        }

        $this->assertSame('complete', $order->fresh()->status);

        $referral->refresh();

        $this->assertSame('qualified', $referral->status);
        $this->assertSame(
            $order->id,
            (int) $referral->qualified_order_id
        );
        $this->assertNotNull($referral->qualified_at);
    }

    public function test_repeat_completion_does_not_qualify_referral_twice(): void
    {
        $referral = $this->createReferral(
            $this->referrerGroup,
            $this->referredGroup
        );

        $order = $this->createOrder();

        $lastPayment = null;

        for ($i = 0; $i < 4; $i++) {
            $lastPayment = $this->completeNextInstallment($order);
        }

        $referral->refresh();

        $this->assertSame('qualified', $referral->status);
        $this->assertSame(
            $order->id,
            (int) $referral->qualified_order_id
        );

        $this->actingAs($this->referredUser, 'sanctum')
            ->postJson(
                "/api/orders/{$order->id}/payments/{$lastPayment->id}/test-success"
            )
            ->assertUnprocessable();

        $this->assertSame(
            1,
            ReferralUse::query()
                ->where('referred_group_id', $this->referredGroup->id)
                ->where('status', 'qualified')
                ->count()
        );
    }

    public function test_self_referral_does_not_qualify(): void
    {
        $selfReferral = $this->createReferral(
            $this->referredGroup,
            $this->referredGroup
        );

        $order = $this->createOrder();

        for ($i = 0; $i < 4; $i++) {
            $this->completeNextInstallment($order);
        }

        $selfReferral->refresh();

        $this->assertSame('pending', $selfReferral->status);
        $this->assertNull($selfReferral->qualified_order_id);
        $this->assertNull($selfReferral->qualified_at);
    }

    public function test_order_without_referral_completes_normally(): void
    {
        $order = $this->createOrder();

        for ($i = 0; $i < 4; $i++) {
            $this->completeNextInstallment($order);
        }

        $this->assertSame('complete', $order->fresh()->status);

        $this->assertSame(
            0,
            ReferralUse::query()
                ->where('referred_group_id', $this->referredGroup->id)
                ->where('status', 'qualified')
                ->count()
        );
    }
}
