<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Group;
use App\Models\Order;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class GroupController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $search = trim((string) $request->query('search', ''));

        $groups = Group::query()
            ->with([
                'college:id,name',
                'members:id,group_id,name,email,student_id,mobile,is_leader',
            ])
            ->when($search !== '', function ($query) use ($search) {
                $like = '%'.$search.'%';

                $query->where(function ($q) use ($like) {
                    $q->where('id', 'like', $like)
                        ->orWhere('guide_name', 'like', $like)
                        ->orWhere('guide_mobile', 'like', $like)
                        ->orWhere('second_guide_name', 'like', $like)
                        ->orWhere('pincode', 'like', $like)
                        ->orWhereHas('college', function ($college) use ($like) {
                            $college->where('name', 'like', $like);
                        })
                        ->orWhereHas('members', function ($member) use ($like) {
                            $member->where('name', 'like', $like)
                                ->orWhere('email', 'like', $like)
                                ->orWhere('student_id', 'like', $like)
                                ->orWhere('mobile', 'like', $like);
                        });
                });
            })
            ->latest('id')
            ->paginate(15)
            ->withQueryString();

        $groups->getCollection()->transform(function (Group $group) {
            return [
                'id' => $group->id,
                'member_count' => (int) (
                    $group->member_count ?? $group->members->count()
                ),
                'pincode' => $group->pincode,
                'whatsapp' => $group->whatsapp,
                'college' => $group->college ? [
                    'id' => $group->college->id,
                    'name' => $group->college->name,
                ] : null,
                'guide_name' => $group->guide_name,
                'guide_mobile' => $group->guide_mobile,
                'second_guide_name' => $group->second_guide_name,
                'second_guide_mobile' => $group->second_guide_mobile,
                'members' => $group->members->map(fn ($member) => [
                    'id' => $member->id,
                    'name' => $member->name,
                    'email' => $member->email,
                    'student_id' => $member->student_id,
                    'mobile' => $member->mobile,
                    'is_leader' => (bool) $member->is_leader,
                ])->values(),
                'created_at' => $group->created_at,
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $groups,
        ]);
    }

    public function show(int $id): JsonResponse
    {
        $group = Group::query()
            ->with([
                'college:id,name',
                'members:id,group_id,name,email,student_id,mobile,is_leader',
            ])
            ->find($id);

        if (! $group) {
            return response()->json([
                'success' => false,
                'message' => 'Group not found.',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $group->id,
                'member_count' => (int) (
                    $group->member_count ?? $group->members->count()
                ),
                'pincode' => $group->pincode,
                'whatsapp' => $group->whatsapp,
                'college' => $group->college ? [
                    'id' => $group->college->id,
                    'name' => $group->college->name,
                ] : null,
                'guide_name' => $group->guide_name,
                'guide_mobile' => $group->guide_mobile,
                'second_guide_name' => $group->second_guide_name,
                'second_guide_mobile' => $group->second_guide_mobile,
                'members' => $group->members->map(fn ($member) => [
                    'id' => $member->id,
                    'name' => $member->name,
                    'email' => $member->email,
                    'student_id' => $member->student_id,
                    'mobile' => $member->mobile,
                    'is_leader' => (bool) $member->is_leader,
                ])->values(),
                'created_at' => $group->created_at,
            ],
        ]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $group = Group::find($id);
        if (! $group) {
            return response()->json(['success' => false, 'message' => 'Group not found.'], 404);
        }

        $data = $request->validate([
            'pincode'             => ['required', 'string', 'max:10'],
            'whatsapp'            => ['nullable', 'string', 'max:20'],
            'guide_name'          => ['required', 'string', 'max:255'],
            'guide_mobile'        => ['required', 'string', 'max:20'],
            'second_guide_name'   => ['nullable', 'string', 'max:255'],
            'second_guide_mobile' => ['nullable', 'string', 'max:20'],
        ]);

        $group->update($data);

        return response()->json(['success' => true, 'message' => 'Group updated.']);
    }

    public function destroy(int $id): JsonResponse
    {
        $group = Group::find($id);
        if (! $group) {
            return response()->json(['success' => false, 'message' => 'Group not found.'], 404);
        }

        $studentIds = User::where('group_id', $id)->where('role', '!=', 'admin')->pluck('id');

        if (Order::whereIn('user_id', $studentIds)->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Group members have orders. Deleting would remove payment records.',
            ], 422);
        }

        try {
            DB::transaction(function () use ($group, $studentIds) {
                User::whereIn('id', $studentIds)->delete();
                $group->delete();
            });
        } catch (QueryException $e) {
            return response()->json(['success' => false, 'message' => 'Group is linked to other data and cannot be deleted.'], 422);
        }

        return response()->json(['success' => true, 'message' => 'Group deleted.']);
    }
}
