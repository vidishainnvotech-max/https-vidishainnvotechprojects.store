<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Models\Group;
use App\Models\GroupMember;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(Request $request)
    {
        // Normalize values before validation and duplicate checks.
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
                    $member['student_id'] = trim($member['student_id']);
                }

                if (isset($member['mobile']) && is_string($member['mobile'])) {
                    $member['mobile'] = trim($member['mobile']);
                }
            }
            unset($member);

            $request->merge(['members' => $members]);
        }

        $validated = $request->validate([
            'members' => ['required', 'array', 'min:1', 'max:5'],
            'members.*.name' => ['required', 'string', 'max:255'],
            'members.*.email' => ['required', 'email', 'distinct:ignore_case', 'max:255'],
            'members.*.student_id' => ['required', 'string', 'max:100', 'distinct:ignore_case'],
            'members.*.mobile' => ['required', 'string', 'max:20', 'distinct'],
            'members.*.is_leader' => ['required', 'boolean'],

            'college_id' => ['required', 'integer', 'exists:colleges,id'],

            'pincode' => ['required', 'string', 'max:10'],
            'whatsapp' => ['required', 'string', 'max:20'],

            'guide_name' => ['required', 'string', 'max:255'],
            'guide_mobile' => ['required', 'string', 'max:20'],

            'second_guide_name' => [
                'nullable',
                'string',
                'max:255',
                'required_with:second_guide_mobile',
            ],
            'second_guide_mobile' => [
                'nullable',
                'string',
                'max:20',
                'required_with:second_guide_name',
            ],

            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $leaders = collect($validated['members'])
            ->filter(fn ($member) => (bool) $member['is_leader']);

        if ($leaders->count() !== 1) {
            throw ValidationException::withMessages([
                'members' => ['Exactly one group leader is required.'],
            ]);
        }

        $leader = $leaders->first();

        // Every member must be unique against existing accounts and groups.
        foreach ($validated['members'] as $member) {
            if (User::whereRaw('LOWER(email) = ?', [$member['email']])->exists()) {
                throw ValidationException::withMessages([
                    'members' => ["The email {$member['email']} is already registered."],
                ]);
            }

            if (User::where('mobile', $member['mobile'])->exists()) {
                throw ValidationException::withMessages([
                    'members' => ["The mobile number {$member['mobile']} is already registered."],
                ]);
            }

            if (GroupMember::whereRaw('LOWER(email) = ?', [$member['email']])->exists()) {
                throw ValidationException::withMessages([
                    'members' => ["The email {$member['email']} is already used by another group member."],
                ]);
            }

            if (
                GroupMember::whereRaw('LOWER(student_id) = ?', [
                    strtolower($member['student_id']),
                ])->exists()
            ) {
                throw ValidationException::withMessages([
                    'members' => ["The student ID {$member['student_id']} is already registered."],
                ]);
            }

            if (GroupMember::where('mobile', $member['mobile'])->exists()) {
                throw ValidationException::withMessages([
                    'members' => ["The mobile number {$member['mobile']} is already registered."],
                ]);
            }
        }

        // Create all registration records atomically.
        $result = DB::transaction(function () use ($validated, $leader) {
            $group = Group::create([
                'college_id' => $validated['college_id'],
                'member_count' => count($validated['members']),
                'pincode' => $validated['pincode'],
                'whatsapp' => $validated['whatsapp'],
                'guide_name' => $validated['guide_name'],
                'guide_mobile' => $validated['guide_mobile'],
                'second_guide_name' => $validated['second_guide_name'] ?? null,
                'second_guide_mobile' => $validated['second_guide_mobile'] ?? null,
            ]);

            foreach ($validated['members'] as $member) {
                GroupMember::create([
                    'group_id' => $group->id,
                    'name' => $member['name'],
                    'email' => $member['email'],
                    'student_id' => $member['student_id'],
                    'mobile' => $member['mobile'],
                    'is_leader' => (bool) $member['is_leader'],
                ]);
            }

            // Only the group leader receives a login account.
            $user = User::create([
                'name' => $leader['name'],
                'email' => $leader['email'],
                'mobile' => $leader['mobile'],
                'college_id' => $validated['college_id'],
                'group_id' => $group->id,
                'password' => Hash::make($validated['password']),
                'role' => 'student',
            ]);

            return [
                'group' => $group,
                'user' => $user,
            ];
        });

        // This requires working mail configuration in the environment.
        $result['user']->sendEmailVerificationNotification();

        return response()->json([
            'message' => 'Registration successful. Please check your email and verify your account before logging in.',
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
                    ]
                    : null,
            ],
        ]);
    }
}
