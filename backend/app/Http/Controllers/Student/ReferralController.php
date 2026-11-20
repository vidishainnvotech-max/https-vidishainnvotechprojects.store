<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Models\Coupon;
use App\Models\ReferralCode;
use App\Models\ReferralUse;
use Illuminate\Http\Request;

class ReferralController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $groupId = $user->group_id;

        if (! $groupId) {
            return response()->json([
                'message' => 'Your account is not associated with a group.',
            ], 422);
        }

        $referralCode = ReferralCode::query()
            ->where('group_id', $groupId)
            ->first();

        $referrals = ReferralUse::query()
            ->where('referrer_group_id', $groupId)
            ->with([
                'referredGroup:id,guide_name,college_id',
                'qualifiedOrder:id,project_id,plan_id,total,status',
            ])
            ->latest('id')
            ->get()
            ->map(function (ReferralUse $referral) {
                return [
                    'id' => $referral->id,
                    'status' => $referral->status,
                    'qualified_at' => $referral->qualified_at,
                    'referred_group' => $referral->referredGroup
                        ? [
                            'id' => $referral->referredGroup->id,
                            'name' => $referral->referredGroup->name,
                        ]
                        : null,
                    'qualified_order' => $referral->qualifiedOrder
                        ? [
                            'id' => $referral->qualifiedOrder->id,
                            'project_id' => $referral->qualifiedOrder->project_id,
                            'plan_id' => $referral->qualifiedOrder->plan_id,
                            'total' => $referral->qualifiedOrder->total,
                            'status' => $referral->qualifiedOrder->status,
                        ]
                        : null,
                ];
            });

        $qualifiedCount = ReferralUse::query()
            ->where('referrer_group_id', $groupId)
            ->where('status', 'qualified')
            ->count();

        $pendingCount = ReferralUse::query()
            ->where('referrer_group_id', $groupId)
            ->where('status', 'pending')
            ->count();

        $rewardCoupons = Coupon::query()
            ->where('owner_group_id', $groupId)
            ->where('source', 'referral_reward')
            ->latest('id')
            ->get([
                'id',
                'code',
                'type',
                'value',
                'scope',
                'project_id',
                'valid_from',
                'valid_until',
                'max_uses',
                'used_count',
                'is_active',
                'created_at',
            ])
            ->map(function (Coupon $coupon) {
                return [
                    'id' => $coupon->id,
                    'code' => $coupon->code,
                    'type' => $coupon->type,
                    'value' => $coupon->value,
                    'scope' => $coupon->scope,
                    'project_id' => $coupon->project_id,
                    'valid_from' => $coupon->valid_from,
                    'valid_until' => $coupon->valid_until,
                    'max_uses' => $coupon->max_uses,
                    'used_count' => $coupon->used_count,
                    'is_active' => $coupon->is_active,
                    'created_at' => $coupon->created_at,
                ];
            });

        return response()->json([
            'referral_code' => $referralCode ? [
                'code' => $referralCode->code,
                'is_active' => $referralCode->is_active,
            ] : null,
            'summary' => [
                'total_referrals' => $referrals->count(),
                'qualified_referrals' => $qualifiedCount,
                'pending_referrals' => $pendingCount,
                'reward_threshold' => (int) config(
                    'referrals.reward_threshold',
                    5
                ),
                'reward_discount_percent' => (float) config(
                    'referrals.reward_discount_percent',
                    20
                ),
            ],
            'referrals' => $referrals,
            'reward_coupons' => $rewardCoupons,
        ]);
    }
}
