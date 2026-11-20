<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Coupon;
use App\Models\Project;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class CouponController extends Controller
{
    public function index(Request $request)
    {
        $coupons = Coupon::query()
            ->with([
                'project:id,title',
                'ownerGroup:id,name',
                'creator:id,name',
            ])
            ->when($request->filled('search'), function ($query) use ($request) {
                $search = trim((string) $request->input('search'));

                $query->where(function ($q) use ($search) {
                    $q->where('code', 'like', '%'.$search.'%')
                        ->orWhere('source', 'like', '%'.$search.'%');
                });
            })
            ->when(
                $request->filled('source'),
                fn ($query) => $query->where(
                    'source',
                    $request->input('source')
                )
            )
            ->when(
                $request->has('is_active')
                    && in_array((string) $request->input('is_active'), ['0', '1'], true),
                fn ($query) => $query->where(
                    'is_active',
                    (bool) $request->boolean('is_active')
                )
            )
            ->latest('id')
            ->paginate(min(max((int) $request->input('per_page', 15), 1), 100));

        return response()->json($coupons);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'code' => [
                'required',
                'string',
                'max:50',
                'regex:/^[A-Za-z0-9_-]+$/',
                'unique:coupons,code',
            ],
            'type' => ['required', Rule::in(['percentage', 'fixed'])],
            'value' => ['required', 'numeric', 'gt:0'],
            'scope' => ['required', Rule::in(['site_wide', 'project'])],
            'project_id' => [
                'nullable',
                'integer',
                'exists:projects,id',
            ],
            'valid_from' => ['nullable', 'date'],
            'valid_until' => [
                'nullable',
                'date',
                'after_or_equal:valid_from',
            ],
            'max_uses' => ['nullable', 'integer', 'min:1'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $this->validateCouponConfiguration($validated);

        $coupon = DB::transaction(function () use ($validated, $request) {
            return Coupon::create([
                'code' => strtoupper(trim($validated['code'])),
                'type' => $validated['type'],
                'value' => $validated['value'],
                'scope' => $validated['scope'],
                'project_id' => $validated['scope'] === 'project'
                    ? $validated['project_id']
                    : null,
                'source' => 'admin',
                'owner_group_id' => null,
                'created_by' => $request->user()->id,
                'valid_from' => $validated['valid_from'] ?? null,
                'valid_until' => $validated['valid_until'] ?? null,
                'max_uses' => $validated['max_uses'] ?? null,
                'used_count' => 0,
                'is_active' => $validated['is_active'] ?? true,
            ]);
        });

        return response()->json([
            'message' => 'Coupon created successfully.',
            'coupon' => $coupon->load([
                'project:id,title',
                'creator:id,name',
            ]),
        ], 201);
    }

    public function show(Coupon $coupon)
    {
        return response()->json([
            'coupon' => $coupon->load([
                'project:id,title',
                'ownerGroup:id,name',
                'creator:id,name',
                'redemptions',
            ]),
        ]);
    }

    public function update(Request $request, Coupon $coupon)
    {
        if ($coupon->source === 'referral_reward') {
            return response()->json([
                'message' => 'Referral reward coupons cannot be edited through admin coupon management.',
            ], 403);
        }

        $validated = $request->validate([
            'code' => [
                'sometimes',
                'required',
                'string',
                'max:50',
                'regex:/^[A-Za-z0-9_-]+$/',
                Rule::unique('coupons', 'code')->ignore($coupon->id),
            ],
            'type' => [
                'sometimes',
                'required',
                Rule::in(['percentage', 'fixed']),
            ],
            'value' => ['sometimes', 'required', 'numeric', 'gt:0'],
            'scope' => [
                'sometimes',
                'required',
                Rule::in(['site_wide', 'project']),
            ],
            'project_id' => [
                'sometimes',
                'nullable',
                'integer',
                'exists:projects,id',
            ],
            'valid_from' => ['sometimes', 'nullable', 'date'],
            'valid_until' => [
                'sometimes',
                'nullable',
                'date',
                'after_or_equal:valid_from',
            ],
            'max_uses' => ['sometimes', 'nullable', 'integer', 'min:1'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $effective = array_merge($coupon->only([
            'code',
            'type',
            'value',
            'scope',
            'project_id',
            'valid_from',
            'valid_until',
            'max_uses',
            'is_active',
        ]), $validated);

        $effective['code'] = strtoupper(trim($effective['code']));
        $this->validateCouponConfiguration($effective);

        if (
            (int) $coupon->used_count > 0
            && array_intersect(
                array_keys($validated),
                ['code', 'type', 'value', 'scope', 'project_id']
            )
        ) {
            return response()->json([
                'message' => 'A coupon that has already been used cannot have its code, discount, or scope changed.',
            ], 422);
        }

        if (
            array_key_exists('max_uses', $validated)
            && $validated['max_uses'] !== null
            && (int) $validated['max_uses'] < (int) $coupon->used_count
        ) {
            return response()->json([
                'message' => 'Maximum uses cannot be lower than the current usage count.',
            ], 422);
        }

        $coupon = DB::transaction(function () use ($coupon, $validated) {
            $lockedCoupon = Coupon::query()
                ->whereKey($coupon->id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($lockedCoupon->source === 'referral_reward') {
                throw ValidationException::withMessages([
                    'coupon' => 'Referral reward coupons cannot be edited through admin coupon management.',
                ]);
            }

            if (
                (int) $lockedCoupon->used_count > 0
                && array_intersect(
                    array_keys($validated),
                    ['code', 'type', 'value', 'scope', 'project_id']
                )
            ) {
                throw ValidationException::withMessages([
                    'coupon' => 'A coupon that has already been used cannot have its code, discount, or scope changed.',
                ]);
            }

            if (
                array_key_exists('max_uses', $validated)
                && $validated['max_uses'] !== null
                && (int) $validated['max_uses'] < (int) $lockedCoupon->used_count
            ) {
                throw ValidationException::withMessages([
                    'max_uses' => 'Maximum uses cannot be lower than the current usage count.',
                ]);
            }

            $updates = $validated;

            if (array_key_exists('code', $updates)) {
                $updates['code'] = strtoupper(trim($updates['code']));
            }

            $scope = $updates['scope'] ?? $lockedCoupon->scope;

            if ($scope === 'site_wide') {
                $updates['project_id'] = null;
            }

            $lockedCoupon->update($updates);

            return $lockedCoupon->fresh();
        });

        return response()->json([
            'message' => 'Coupon updated successfully.',
            'coupon' => $coupon->load([
                'project:id,title',
                'creator:id,name',
            ]),
        ]);
    }

    public function destroy(Coupon $coupon)
    {
        if ($coupon->source === 'referral_reward') {
            return response()->json([
                'message' => 'Referral reward coupons cannot be disabled through admin coupon management.',
            ], 403);
        }

        $coupon->update([
            'is_active' => false,
        ]);

        return response()->json([
            'message' => 'Coupon disabled successfully.',
            'coupon' => $coupon->fresh(),
        ]);
    }

    private function validateCouponConfiguration(array $data): void
    {
        if (
            $data['type'] === 'percentage'
            && (float) $data['value'] > 100
        ) {
            throw ValidationException::withMessages([
                'value' => 'Percentage discount cannot exceed 100%.',
            ]);
        }

        if (
            $data['scope'] === 'project'
            && empty($data['project_id'])
        ) {
            throw ValidationException::withMessages([
                'project_id' => 'A project must be selected for a project-specific coupon.',
            ]);
        }

        if (
            $data['scope'] === 'project'
            && ! empty($data['project_id'])
            && ! Project::query()
                ->whereKey($data['project_id'])
                ->exists()
        ) {
            throw ValidationException::withMessages([
                'project_id' => 'The selected project does not exist.',
            ]);
        }

        if (
            ! empty($data['valid_from'])
            && ! empty($data['valid_until'])
            && strtotime((string) $data['valid_until'])
                < strtotime((string) $data['valid_from'])
        ) {
            throw ValidationException::withMessages([
                'valid_until' => 'The expiry date must be on or after the start date.',
            ]);
        }
    }
}
