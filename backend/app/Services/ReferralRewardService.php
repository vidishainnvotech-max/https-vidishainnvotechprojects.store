<?php

namespace App\Services;

use App\Models\Coupon;
use App\Models\ReferralUse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ReferralRewardService
{
    private const DEFAULT_THRESHOLD = 5;

    private const DEFAULT_DISCOUNT_PERCENT = 20;

    public function issueEligibleRewards(): int
    {
        return DB::transaction(function () {
            $threshold = (int) config(
                'referrals.reward_threshold',
                self::DEFAULT_THRESHOLD
            );

            $discountPercent = (float) config(
                'referrals.reward_discount_percent',
                self::DEFAULT_DISCOUNT_PERCENT
            );

            if (
                $threshold < 1
                || $discountPercent <= 0
                || $discountPercent > 100
            ) {
                return 0;
            }

            $issued = 0;

            $referrerGroupIds = ReferralUse::query()
                ->where('status', 'qualified')
                ->select('referrer_group_id')
                ->distinct()
                ->pluck('referrer_group_id');

            foreach ($referrerGroupIds as $groupId) {
                $qualifiedCount = ReferralUse::query()
                    ->where('referrer_group_id', $groupId)
                    ->where('status', 'qualified')
                    ->count();

                if ($qualifiedCount < $threshold) {
                    continue;
                }

                $existingRewardCount = Coupon::query()
                    ->where('owner_group_id', $groupId)
                    ->where('source', 'referral_reward')
                    ->count();

                $eligibleRewardCount = intdiv(
                    $qualifiedCount,
                    $threshold
                );

                while ($existingRewardCount < $eligibleRewardCount) {
                    do {
                        $code = 'REF'.Str::upper(Str::random(8));
                    } while (
                        Coupon::query()->where('code', $code)->exists()
                    );

                    Coupon::create([
                        'code' => $code,
                        'type' => 'percentage',
                        'value' => $discountPercent,
                        'scope' => 'site_wide',
                        'project_id' => null,
                        'source' => 'referral_reward',
                        'owner_group_id' => $groupId,
                        'created_by' => null,
                        'valid_from' => now(),
                        'valid_until' => null,
                        'max_uses' => 1,
                        'used_count' => 0,
                        'is_active' => true,
                    ]);

                    $existingRewardCount++;
                    $issued++;
                }
            }

            return $issued;
        });
    }
}
