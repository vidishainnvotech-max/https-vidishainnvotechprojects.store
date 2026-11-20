<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\GroupMember;
use App\Models\User;
use App\Models\UserAccess;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    private const ALLOWED_STAGES = [20, 50, 75, 100];

    public function index(Request $request): JsonResponse
    {
        $search = trim((string) $request->query('search', ''));

        $users = User::query()
            ->with([
                'group.college:id,name',
                'group.members:id,group_id,name,email,student_id,mobile,is_leader',
            ])
            ->select([
                'id',
                'name',
                'email',
                'mobile',
                'college_id',
                'group_id',
                'role',
                'created_at',
            ])
            ->when($search !== '', function ($query) use ($search) {
                $like = '%'.$search.'%';

                $query->where(function ($inner) use ($like) {
                    $inner->where('name', 'like', $like)
                        ->orWhere('email', 'like', $like)
                        ->orWhere('mobile', 'like', $like)
                        ->orWhere('college_id', 'like', $like);
                });
            })
            ->latest('created_at')
            ->paginate(15);

        $users->getCollection()->transform(function ($user) {
            return $this->formatUser($user);
        });

        return response()->json([
            'success' => true,
            'data' => $users,
        ]);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $user = User::query()
            ->with([
                'group.college:id,name',
                'group.members:id,group_id,name,email,student_id,mobile,is_leader',
            ])
            ->select([
                'id',
                'name',
                'email',
                'mobile',
                'college_id',
                'group_id',
                'role',
                'created_at',
            ])
            ->find($id);

        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'User not found.',
            ], 404);
        }

        $formattedUser = $this->formatUser($user);

        $formattedUser['user_access'] = $user->userAccess()
            ->with('project:id,title,slug')
            ->orderBy('project_id')
            ->orderBy('stage_percent')
            ->get()
            ->map(fn ($access) => [
                'id' => $access->id,
                'project_id' => $access->project_id,
                'stage_percent' => (int) $access->stage_percent,
                'project' => $access->project ? [
                    'id' => $access->project->id,
                    'title' => $access->project->title,
                    'slug' => $access->project->slug,
                ] : null,
            ])
            ->values();

        return response()->json([
            'success' => true,
            'data' => $formattedUser,
        ]);
    }

    public function access(Request $request, int $id): JsonResponse
    {
        $user = User::query()
            ->select([
                'id',
                'name',
                'email',
            ])
            ->find($id);

        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'User not found.',
            ], 404);
        }

        $records = $user->userAccess()
            ->with('project:id,title,slug')
            ->orderBy('project_id')
            ->orderBy('stage_percent')
            ->get();

        $projects = $records
            ->groupBy('project_id')
            ->map(function ($rows) {
                $project = $rows->first()->project;

                $access = $rows
                    ->map(fn ($record) => [
                        'id' => $record->id,
                        'stage_percent' => (int) $record->stage_percent,
                    ])
                    ->values();

                $highestStage = $access->max(
                    'stage_percent'
                ) ?? 0;

                return [
                    'id' => $project?->id,
                    'title' => $project?->title,
                    'slug' => $project?->slug,
                    'highest_stage' => (int) $highestStage,
                    'fully_unlocked' => (int) $highestStage >= 100,
                    'access' => $access,
                ];
            })
            ->values();

        return response()->json([
            'success' => true,
            'data' => [
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                ],
                'projects' => $projects,
            ],
        ]);
    }

    public function grantAccess(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => [
                'required',
                'integer',
                Rule::exists('users', 'id'),
            ],
            'project_id' => [
                'required',
                'integer',
                Rule::exists('projects', 'id'),
            ],
        ]);

        $access = UserAccess::firstOrCreate([
            'user_id' => $validated['user_id'],
            'project_id' => $validated['project_id'],
            'stage_percent' => 20,
        ]);

        return response()->json([
            'success' => true,
            'created' => $access->wasRecentlyCreated,
            'data' => [
                'id' => $access->id,
                'user_id' => $access->user_id,
                'project_id' => $access->project_id,
                'stage_percent' => (int) $access->stage_percent,
            ],
        ], 200);
    }

    public function grantStageAccess(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => [
                'required',
                'integer',
                Rule::exists('users', 'id'),
            ],
            'project_id' => [
                'required',
                'integer',
                Rule::exists('projects', 'id'),
            ],
            'stage_percent' => [
                'required',
                'integer',
                Rule::in(self::ALLOWED_STAGES),
            ],
        ]);

        foreach (self::ALLOWED_STAGES as $stage) {
            if ($stage > $validated['stage_percent']) {
                break;
            }

            UserAccess::firstOrCreate([
                'user_id' => $validated['user_id'],
                'project_id' => $validated['project_id'],
                'stage_percent' => $stage,
            ]);
        }

        $access = UserAccess::query()
            ->where('user_id', $validated['user_id'])
            ->where('project_id', $validated['project_id'])
            ->orderBy('stage_percent')
            ->get()
            ->map(fn ($record) => [
                'id' => $record->id,
                'stage_percent' => (int) $record->stage_percent,
            ])
            ->values();

        $highestStage = $access->max(
            'stage_percent'
        ) ?? 0;

        return response()->json([
            'success' => true,
            'data' => [
                'user_id' => $validated['user_id'],
                'project_id' => $validated['project_id'],
                'granted_stage' => (int) $validated['stage_percent'],
                'highest_stage' => (int) $highestStage,
                'fully_unlocked' => (int) $highestStage >= 100,
                'access' => $access,
            ],
        ], 200);
    }

    public function revokeAccess(
        Request $request,
        int $id
    ): JsonResponse {
        $access = UserAccess::query()->find($id);

        if (! $access) {
            return response()->json([
                'success' => false,
                'message' => 'Access record not found.',
            ], 404);
        }

        $userId = $access->user_id;
        $projectId = $access->project_id;
        $revokedStage = (int) $access->stage_percent;

        $access->delete();

        $higherStages = UserAccess::query()
            ->where('user_id', $userId)
            ->where('project_id', $projectId)
            ->where('stage_percent', '>', $revokedStage)
            ->orderBy('stage_percent')
            ->pluck('stage_percent')
            ->map(fn ($stage) => (int) $stage)
            ->values();

        UserAccess::query()
            ->where('user_id', $userId)
            ->where('project_id', $projectId)
            ->where('stage_percent', '>', $revokedStage)
            ->delete();

        $remainingHighestStage = UserAccess::query()
            ->where('user_id', $userId)
            ->where('project_id', $projectId)
            ->max('stage_percent');

        return response()->json([
            'success' => true,
            'message' => 'Access revoked successfully.',
            'data' => [
                'id' => $access->id,
                'user_id' => $userId,
                'project_id' => $projectId,
                'stage_percent' => $revokedStage,
                'higher_stages_revoked' => $higherStages,
                'highest_stage' => (int) ($remainingHighestStage ?? 0),
                'fully_unlocked' => (int) ($remainingHighestStage ?? 0) >= 100,
            ],
        ], 200);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $user = User::find($id);
        if (! $user) {
            return response()->json(['success' => false, 'message' => 'User not found.'], 404);
        }

        $data = $request->validate([
            'name'   => ['required', 'string', 'max:255'],
            'email'  => ['required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'mobile' => ['nullable', 'string', 'max:20'],
        ]);

        $oldEmail = $user->email;
        $user->update($data);

        // keep the group member row in sync
        if ($user->group_id) {
            GroupMember::where('group_id', $user->group_id)
                ->where('email', $oldEmail)
                ->update(array_filter($data, fn ($v) => $v !== null));
        }

        return response()->json(['success' => true, 'message' => 'User updated.']);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $user = User::withCount('orders')->find($id);
        if (! $user) {
            return response()->json(['success' => false, 'message' => 'User not found.'], 404);
        }
        if ($user->id === $request->user()->id || $user->role === 'admin') {
            return response()->json(['success' => false, 'message' => 'Admin accounts cannot be deleted.'], 422);
        }
        if ($user->orders_count > 0) {
            return response()->json([
                'success' => false,
                'message' => 'This user has orders. Deleting would remove payment records.',
            ], 422);
        }

        try {
            if ($user->group_id) {
                GroupMember::where('group_id', $user->group_id)->where('email', $user->email)->delete();
            }
            $user->delete();
        } catch (QueryException $e) {
            return response()->json(['success' => false, 'message' => 'User is linked to other data and cannot be deleted.'], 422);
        }

        return response()->json(['success' => true, 'message' => 'User deleted.']);
    }

    private function formatUser(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'mobile' => $user->mobile,
            'college_id' => $user->college_id,
            'group_id' => $user->group_id,
            'role' => $user->role,
            'created_at' => $user->created_at,

            'group' => $user->group
                ? [
                    'id' => $user->group->id,
                    'member_count' => (int) $user->group->member_count,
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
                        ->map(function ($member) {
                            return [
                                'id' => $member->id,
                                'name' => $member->name,
                                'email' => $member->email,
                                'student_id' => $member->student_id,
                                'mobile' => $member->mobile,
                                'is_leader' => $member->is_leader,
                            ];
                        })
                        ->values(),
                ]
                : null,
        ];
    }
}
