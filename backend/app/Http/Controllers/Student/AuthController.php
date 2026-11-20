<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Models\Group;
use App\Models\GroupMember;
use App\Models\ReferralCode;
use App\Models\ReferralUse;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(Request $request)
    {
        /*
         * Normalize submitted member values and referral code.
         */
        $members = $request->input('members', []);

        if (is_array($members)) {
            foreach ($members as &$member) {
                if (! is_array($member)) {
                    continue;
                }

                if (isset($member['email']) && is_string($member['email'])) {
                    $member['email'] = strtolower(trim($member['email']));
                }

                if (isset($member['student_id']) && is_string($member['student_id'])) {
                    $member['student_id'] = strtolower(trim($member['student_id']));
                }

                if (isset($member['name']) && is_string($member['name'])) {
                    $member['name'] = trim($member['name']);
                }

                if (isset($member['mobile']) && is_string($member['mobile'])) {
                    $member['mobile'] = trim($member['mobile']);
                }
            }

            unset($member);

            $request->merge(['members' => $members]);
        }

        $referralCodeInput = $request->input('referral_code');

        if (is_string($referralCodeInput)) {
            $referralCodeInput = Str::upper(trim($referralCodeInput));
        }

        $request->merge([
            'referral_code' => $referralCodeInput ?: null,
        ]);

        $validated = $request->validate([
            'members' => ['required', 'array', 'min:1', 'max:5'],
            'members.*.name' => ['required', 'string', 'max:255'],
            'members.*.email' => ['required', 'email', 'max:255', 'distinct:ignore_case'],
            'members.*.student_id' => ['required', 'string', 'max:100', 'distinct:ignore_case'],
            'members.*.mobile' => ['required', 'string', 'regex:/^[6-9]\d{9}$/', 'distinct'],
            'members.*.is_leader' => ['required', 'boolean'],

            'college_id' => ['required', 'integer', 'exists:colleges,id'],
            'pincode' => ['required', 'string', 'regex:/^\d{6}$/'],
            'whatsapp' => ['required', 'string', 'regex:/^[6-9]\d{9}$/'],

            'guide_name' => ['required', 'string', 'max:255'],
            'guide_mobile' => ['required', 'string', 'regex:/^[6-9]\d{9}$/'],

            'second_guide_name' => [
                'nullable',
                'string',
                'max:255',
                'required_with:second_guide_mobile',
            ],
            'second_guide_mobile' => [
                'nullable',
                'string',
                'regex:/^[6-9]\d{9}$/',
                'required_with:second_guide_name',
            ],

            'password' => ['required', 'string', 'min:8', 'confirmed'],

            'referral_code' => [
                'nullable',
                'string',
                'max:32',
                'regex:/^[A-Z0-9]+$/',
            ],
        ], [
            'members.*.mobile.regex'  => 'Enter a valid 10-digit mobile number.',
            'pincode.regex'           => 'Pincode must be 6 digits.',
            'whatsapp.regex'          => 'Enter a valid 10-digit WhatsApp number.',
            'guide_mobile.regex'      => 'Enter a valid 10-digit guide mobile number.',
            'second_guide_mobile.regex' => 'Enter a valid 10-digit mobile number.',
        ]);

        $leaders = collect($validated['members'])
            ->filter(
                fn (array $member) => filter_var(
                    $member['is_leader'],
                    FILTER_VALIDATE_BOOLEAN
                )
            );

        if ($leaders->count() !== 1) {
            throw ValidationException::withMessages([
                'members' => ['Exactly one group leader is required.'],
            ]);
        }

        $leader = $leaders->first();

        /*
         * Preserve existing duplicate checks.
         */
        foreach ($validated['members'] as $member) {
            if (User::whereRaw('LOWER(email) = ?', [$member['email']])->exists()) {
                throw ValidationException::withMessages([
                    'members' => [
                        "The email {$member['email']} is already registered.",
                    ],
                ]);
            }

            if (User::where('mobile', $member['mobile'])->exists()) {
                throw ValidationException::withMessages([
                    'members' => [
                        "The mobile number {$member['mobile']} is already registered.",
                    ],
                ]);
            }

            if (GroupMember::whereRaw('LOWER(email) = ?', [$member['email']])->exists()) {
                throw ValidationException::withMessages([
                    'members' => [
                        "The email {$member['email']} is already used by another group member.",
                    ],
                ]);
            }

            if (GroupMember::whereRaw('LOWER(student_id) = ?', [$member['student_id']])->exists()) {
                throw ValidationException::withMessages([
                    'members' => [
                        "The student ID {$member['student_id']} is already registered.",
                    ],
                ]);
            }

            if (GroupMember::where('mobile', $member['mobile'])->exists()) {
                throw ValidationException::withMessages([
                    'members' => [
                        "The mobile number {$member['mobile']} is already registered.",
                    ],
                ]);
            }
        }

        $submittedReferralCode = $validated['referral_code'] ?? null;

        /*
         * Create the group, members, leader account, and referral records
         * in one transaction.
         */
        $result = DB::transaction(function () use (
            $validated,
            $leader,
            $submittedReferralCode
        ) {
            $referralCode = null;

            if ($submittedReferralCode) {
                $referralCode = ReferralCode::query()
                    ->where('code', $submittedReferralCode)
                    ->where('is_active', true)
                    ->lockForUpdate()
                    ->first();

                if (! $referralCode) {
                    throw ValidationException::withMessages([
                        'referral_code' => [
                            'This referral code is invalid or inactive.',
                        ],
                    ]);
                }
            }

            $group = Group::create([
                'college_id' => $validated['college_id'],
                'member_count' => count($validated['members']),
                'pincode' => trim($validated['pincode']),
                'whatsapp' => trim($validated['whatsapp']),
                'guide_name' => trim($validated['guide_name']),
                'guide_mobile' => trim($validated['guide_mobile']),
                'second_guide_name' => isset($validated['second_guide_name'])
                    ? trim($validated['second_guide_name'])
                    : null,
                'second_guide_mobile' => isset($validated['second_guide_mobile'])
                    ? trim($validated['second_guide_mobile'])
                    : null,
            ]);

            foreach ($validated['members'] as $member) {
                GroupMember::create([
                    'group_id' => $group->id,
                    'name' => $member['name'],
                    'email' => strtolower(trim($member['email'])),
                    'student_id' => trim($member['student_id']),
                    'mobile' => trim($member['mobile']),
                    'is_leader' => filter_var(
                        $member['is_leader'],
                        FILTER_VALIDATE_BOOLEAN
                    ),
                ]);
            }

            $user = User::create([
                'name' => $leader['name'],
                'email' => strtolower(trim($leader['email'])),
                'mobile' => trim($leader['mobile']),
                'college_id' => $validated['college_id'],
                'group_id' => $group->id,
                'password' => Hash::make($validated['password']),
                'role' => 'student',
            ]);

            /*
             * Every new group receives its own unique referral code.
             */
            do {
                $newCode = Str::upper(Str::random(10));
            } while (
                ReferralCode::where('code', $newCode)->exists()
            );

            $ownReferralCode = ReferralCode::create([
                'group_id' => $group->id,
                'code' => $newCode,
                'is_active' => true,
            ]);

            /*
             * Record the referring group.
             * A referral remains pending until an eligible purchase succeeds.
             */
            if ($referralCode) {
                if ((int) $referralCode->group_id === (int) $group->id) {
                    throw ValidationException::withMessages([
                        'referral_code' => [
                            'A group cannot refer itself.',
                        ],
                    ]);
                }

                ReferralUse::create([
                    'referral_code_id' => $referralCode->id,
                    'referrer_group_id' => $referralCode->group_id,
                    'referred_group_id' => $group->id,
                    'status' => 'pending',
                ]);
            }

            return [
                'group' => $group,
                'user' => $user,
                'referral_code' => $ownReferralCode,
            ];
        });

        /*
         * Send verification after the transaction commits.
         */
        $mailSent = true;
        try {
            $result['user']->sendEmailVerificationNotification();
        } catch (\Throwable $e) {
            $mailSent = false;
            Log::error('Verification email failed: '.$e->getMessage());
        }

        return response()->json([
            'message' => $mailSent
                ? 'Registration successful. Please check your email and verify your account before logging in.'
                : 'Account created, but the verification email could not be sent. Please use "Resend verification email".',
            'verification_email_sent' => $mailSent,
            'user' => [
                'id' => $result['user']->id,
                'name' => $result['user']->name,
                'email' => $result['user']->email,
                'mobile' => $result['user']->mobile,
                'role' => $result['user']->role,
                'group_id' => $result['user']->group_id,
                'email_verified_at' => $result['user']->email_verified_at,
            ],
            'group' => [
                'id' => $result['group']->id,
                'member_count' => $result['group']->member_count,
                'college_id' => $result['group']->college_id,
            ],
            'referral' => [
                'code' => $result['referral_code']->code,
            ],
        ], 201);
    }

    public function login(Request $request)
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $email = strtolower(trim($validated['email']));

        $user = User::whereRaw('LOWER(email) = ?', [$email])->first();

        if (! $user || ! Hash::check($validated['password'], $user->password)) {
            return response()->json([
                'message' => 'Invalid credentials.',
            ], 401);
        }

        if (! $user->hasVerifiedEmail()) {
            return response()->json([
                'message' => 'Please verify your email before logging in.',
            ], 403);
        }

        $token = $user->createToken('auth-token')->plainTextToken;

        return response()->json([
            'user' => $user,
            'token' => $token,
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()?->delete();

        return response()->json([
            'message' => 'Logged out successfully.',
        ]);
    }

    public function me(Request $request)
    {
        $user = $request->user()->load([
            'group.college:id,name',
            'group.members:id,group_id,name,email,student_id,mobile,is_leader',
            'group.referralCode:id,group_id,code,is_active',
        ]);

        return response()->json([
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'mobile' => $user->mobile,
                'role' => $user->role,
                'college_id' => $user->college_id,
                'group_id' => $user->group_id,
                'email_verified_at' => $user->email_verified_at,
                'group' => $user->group
                    ? [
                        'id' => $user->group->id,
                        'member_count' => $user->group->member_count,
                        'pincode' => $user->group->pincode,
                        'whatsapp' => $user->group->whatsapp,
                        'guide_name' => $user->group->guide_name,
                        'guide_mobile' => $user->group->guide_mobile,
                        'second_guide_name' => $user->group->second_guide_name,
                        'second_guide_mobile' => $user->group->second_guide_mobile,
                        'college' => $user->group->college
                            ? [
                                'id' => $user->group->college->id,
                                'name' => $user->group->college->name,
                            ]
                            : null,
                        'members' => $user->group->members
                            ->map(fn ($member) => [
                                'id' => $member->id,
                                'name' => $member->name,
                                'email' => $member->email,
                                'student_id' => $member->student_id,
                                'mobile' => $member->mobile,
                                'is_leader' => $member->is_leader,
                            ])
                            ->values(),
                        'referral' => $user->group->referralCode
                            ? [
                                'code' => $user->group->referralCode->code,
                                'is_active' => $user->group->referralCode->is_active,
                            ]
                            : null,
                    ]
                    : null,
            ],
        ]);
    }
}
