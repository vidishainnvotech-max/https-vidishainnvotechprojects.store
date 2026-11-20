<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Coupon;
use App\Models\ReferralCode;
use App\Models\ReferralUse;
use Illuminate\Http\Request;

class ReferralController extends Controller
{
    public function index(Request $request)
    {
        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', 'in:pending,qualified'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $referrals = ReferralUse::query()
            ->with([
                'referralCode:id,group_id,code',
                'referrerGroup:id,guide_name,college_id',
                'referredGroup:id,guide_name,college_id',
                'qualifiedOrder:id,user_id,project_id,plan_id,total,status',
            ])
            ->when(
                ! empty($validated['status']),
                fn ($query) => $query->where('status', $validated['status'])
            )
            ->when(! empty($validated['search']), function ($query) use ($validated) {
                $search = trim($validated['search']);

                $query->where(function ($q) use ($search) {
                    $q->whereHas('referralCode', function ($codeQuery) use ($search) {
                        $codeQuery->where('code', 'like', "%{$search}%");
                    })->orWhereHas('referrerGroup', function ($groupQuery) use ($search) {
                        $groupQuery->where('name', 'like', "%{$search}%");
                    })->orWhereHas('referredGroup', function ($groupQuery) use ($search) {
                        $groupQuery->where('name', 'like', "%{$search}%");
                    });
                });
            })
            ->latest('id')
            ->paginate($validated['per_page'] ?? 15);

        return response()->json([
            'summary' => [
                'total' => ReferralUse::count(),
                'pending' => ReferralUse::where('status', 'pending')->count(),
                'qualified' => ReferralUse::where('status', 'qualified')->count(),
                'active_referral_codes' => ReferralCode::where('is_active', true)->count(),
                'reward_coupons' => Coupon::where('source', 'referral_reward')->count(),
            ],
            'referrals' => $referrals,
        ]);
    }

    public function show(ReferralUse $referral)
    {
        $referral->load([
            'referralCode:id,group_id,code,is_active',
            'referrerGroup:id,guide_name,college_id',
            'referredGroup:id,guide_name,college_id',
            'qualifiedOrder:id,user_id,project_id,plan_id,total,status',
        ]);

        $rewardCoupons = Coupon::query()
            ->where('source', 'referral_reward')
            ->where('owner_group_id', $referral->referrer_group_id)
            ->latest('id')
            ->get([
                'id',
                'code',
                'type',
                'value',
                'scope',
                'project_id',
                'max_uses',
                'used_count',
                'is_active',
                'valid_from',
                'valid_until',
                'created_at',
            ]);

        return response()->json([
            'referral' => $referral,
            'referrer_reward_coupons' => $rewardCoupons,
        ]);
    }

    public function codes(Request $request)
    {
        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'is_active' => ['nullable', 'boolean'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $codes = ReferralCode::query()
            ->with('group:id,guide_name,college_id')
            ->withCount([
                'referralUses as total_referrals',
                'referralUses as qualified_referrals' => function ($query) {
                    $query->where('status', 'qualified');
                },
                'referralUses as pending_referrals' => function ($query) {
                    $query->where('status', 'pending');
                },
            ])
            ->when(! empty($validated['search']), function ($query) use ($validated) {
                $search = trim($validated['search']);

                $query->where(function ($q) use ($search) {
                    $q->where('code', 'like', "%{$search}%")
                        ->orWhereHas('group', function ($groupQuery) use ($search) {
                            $groupQuery->where('name', 'like', "%{$search}%");
                        });
                });
            })
            ->when(
                array_key_exists('is_active', $validated),
                fn ($query) => $query->where('is_active', $validated['is_active'])
            )
            ->latest('id')
            ->paginate($validated['per_page'] ?? 15);

        return response()->json($codes);
    }

    public function rewards(Request $request)
    {
        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'is_active' => ['nullable', 'boolean'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $coupons = Coupon::query()
            ->where('source', 'referral_reward')
            ->with('ownerGroup:id,guide_name,college_id')
            ->when(! empty($validated['search']), function ($query) use ($validated) {
                $search = trim($validated['search']);

                $query->where(function ($q) use ($search) {
                    $q->where('code', 'like', "%{$search}%")
                        ->orWhereHas('ownerGroup', function ($groupQuery) use ($search) {
                            $groupQuery->where('name', 'like', "%{$search}%");
                        });
                });
            })
            ->when(
                array_key_exists('is_active', $validated),
                fn ($query) => $query->where('is_active', $validated['is_active'])
            )
            ->latest('id')
            ->paginate($validated['per_page'] ?? 15);

        return response()->json($coupons);
    }
}
