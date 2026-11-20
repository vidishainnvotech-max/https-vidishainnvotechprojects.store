<?php

namespace Tests\Feature;

use App\Models\College;
use App\Models\Coupon;
use App\Models\Group;
use App\Models\ReferralCode;
use App\Models\ReferralUse;
use App\Services\ReferralRewardService;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReferralRewardServiceTest extends TestCase
{
    use RefreshDatabase;

    private function createGroup(): Group
    {
        $college = College::create([
            'name' => 'Test College '.uniqid(),
        ]);

        return Group::create([
            'college_id' => $college->id,
            'member_count' => 1,
            'pincode' => '422001',
            'whatsapp' => '9000000000',
            'guide_name' => 'Test Guide',
            'guide_mobile' => '9000000001',
        ]);
    }

    private function getOrCreateReferralCode(
        Group $group,
        bool $active = true
    ): ReferralCode {
        return ReferralCode::firstOrCreate(
            ['group_id' => $group->id],
            [
                'code' => 'REF'.strtoupper(uniqid()),
                'is_active' => $active,
            ]
        );
    }

    private function createQualifiedReferral(
        Group $referrer,
        Group $referred
    ): ReferralUse {
        $referralCode = $this->getOrCreateReferralCode($referrer);

        return ReferralUse::create([
            'referral_code_id' => $referralCode->id,
            'referrer_group_id' => $referrer->id,
            'referred_group_id' => $referred->id,
            'qualified_order_id' => null,
            'status' => 'qualified',
            'qualified_at' => now(),
        ]);
    }

    private function createPendingReferral(
        Group $referrer,
        Group $referred
    ): ReferralUse {
        $referralCode = $this->getOrCreateReferralCode($referrer);

        return ReferralUse::create([
            'referral_code_id' => $referralCode->id,
            'referrer_group_id' => $referrer->id,
            'referred_group_id' => $referred->id,
            'qualified_order_id' => null,
            'status' => 'pending',
            'qualified_at' => null,
        ]);
    }

    private function createQualifiedReferrals(
        Group $referrer,
        int $count
    ): void {
        for ($i = 0; $i < $count; $i++) {
            $this->createQualifiedReferral(
                $referrer,
                $this->createGroup()
            );
        }
    }

    public function test_no_reward_is_created_before_five_qualified_referrals(): void
    {
        $referrer = $this->createGroup();

        $this->createQualifiedReferrals($referrer, 4);

        $issued = app(ReferralRewardService::class)
            ->issueEligibleRewards();

        $this->assertSame(0, $issued);

        $this->assertDatabaseMissing('coupons', [
            'owner_group_id' => $referrer->id,
            'source' => 'referral_reward',
        ]);
    }

    public function test_pending_referrals_do_not_count_toward_rewards(): void
    {
        $referrer = $this->createGroup();

        $this->createQualifiedReferrals($referrer, 4);

        $this->createPendingReferral(
            $referrer,
            $this->createGroup()
        );

        $issued = app(ReferralRewardService::class)
            ->issueEligibleRewards();

        $this->assertSame(0, $issued);

        $this->assertDatabaseMissing('coupons', [
            'owner_group_id' => $referrer->id,
            'source' => 'referral_reward',
        ]);
    }

    public function test_one_reward_is_created_after_five_qualified_referrals(): void
    {
        $referrer = $this->createGroup();

        $this->createQualifiedReferrals($referrer, 5);

        $issued = app(ReferralRewardService::class)
            ->issueEligibleRewards();

        $this->assertSame(1, $issued);

        $this->assertDatabaseHas('coupons', [
            'owner_group_id' => $referrer->id,
            'source' => 'referral_reward',
            'type' => 'percentage',
            'value' => 20,
            'scope' => 'site_wide',
            'max_uses' => 1,
            'is_active' => 1,
        ]);
    }

    public function test_running_service_twice_does_not_duplicate_rewards(): void
    {
        $referrer = $this->createGroup();

        $this->createQualifiedReferrals($referrer, 5);

        $service = app(ReferralRewardService::class);

        $firstRun = $service->issueEligibleRewards();
        $secondRun = $service->issueEligibleRewards();

        $this->assertSame(1, $firstRun);
        $this->assertSame(0, $secondRun);

        $this->assertSame(
            1,
            Coupon::query()
                ->where('owner_group_id', $referrer->id)
                ->where('source', 'referral_reward')
                ->count()
        );
    }

    public function test_ten_qualified_referrals_create_two_reward_coupons(): void
    {
        $referrer = $this->createGroup();

        $this->createQualifiedReferrals($referrer, 10);

        $issued = app(ReferralRewardService::class)
            ->issueEligibleRewards();

        $this->assertSame(2, $issued);

        $this->assertSame(
            2,
            Coupon::query()
                ->where('owner_group_id', $referrer->id)
                ->where('source', 'referral_reward')
                ->count()
        );
    }

    public function test_reward_coupon_has_single_use_and_no_expiry(): void
    {
        $referrer = $this->createGroup();

        $this->createQualifiedReferrals($referrer, 5);

        app(ReferralRewardService::class)->issueEligibleRewards();

        $coupon = Coupon::query()
            ->where('owner_group_id', $referrer->id)
            ->where('source', 'referral_reward')
            ->firstOrFail();

        $this->assertSame('percentage', $coupon->type);
        $this->assertEquals(20, $coupon->value);
        $this->assertSame('site_wide', $coupon->scope);
        $this->assertSame(1, $coupon->max_uses);
        $this->assertSame(0, $coupon->used_count);
        $this->assertTrue($coupon->is_active);
        $this->assertNotNull($coupon->valid_from);
        $this->assertNull($coupon->valid_until);
    }

    public function test_reward_coupon_belongs_to_the_correct_referrer_group(): void
    {
        $firstReferrer = $this->createGroup();
        $secondReferrer = $this->createGroup();

        $this->createQualifiedReferrals($firstReferrer, 5);
        $this->createQualifiedReferrals($secondReferrer, 4);

        app(ReferralRewardService::class)->issueEligibleRewards();

        $this->assertSame(
            1,
            Coupon::query()
                ->where('owner_group_id', $firstReferrer->id)
                ->where('source', 'referral_reward')
                ->count()
        );

        $this->assertSame(
            0,
            Coupon::query()
                ->where('owner_group_id', $secondReferrer->id)
                ->where('source', 'referral_reward')
                ->count()
        );
    }

    public function test_a_referred_group_cannot_be_attributed_twice(): void
    {
        $firstReferrer = $this->createGroup();
        $secondReferrer = $this->createGroup();
        $referred = $this->createGroup();

        $this->createQualifiedReferral($firstReferrer, $referred);

        $this->expectException(QueryException::class);

        $this->createQualifiedReferral($secondReferrer, $referred);
    }

    public function test_inactive_referral_code_does_not_become_active_automatically(): void
    {
        $referrer = $this->createGroup();

        $referralCode = ReferralCode::create([
            'group_id' => $referrer->id,
            'code' => 'REF'.strtoupper(uniqid()),
            'is_active' => false,
        ]);

        $retrievedCode = $this->getOrCreateReferralCode(
            $referrer,
            true
        );

        $this->assertSame($referralCode->id, $retrievedCode->id);
        $this->assertFalse($retrievedCode->fresh()->is_active);

        $this->assertSame(
            1,
            ReferralCode::where('group_id', $referrer->id)->count()
        );
    }
}
