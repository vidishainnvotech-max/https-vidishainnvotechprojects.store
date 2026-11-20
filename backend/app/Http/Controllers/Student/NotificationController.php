<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Models\StudentNotification;
use App\Services\StudentNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request, StudentNotificationService $notifications): JsonResponse
    {
        $user = $request->user();
        $notifications->syncFor($user);

        return response()->json([
            'success' => true,
            'unread_count' => StudentNotification::query()
                ->where('user_id', $user->id)
                ->whereNull('read_at')
                ->count(),
            'data' => StudentNotification::query()
                ->where('user_id', $user->id)
                ->latest('occurred_at')
                ->latest('id')
                ->limit(30)
                ->get(),
        ]);
    }

    public function markRead(Request $request, int $id): JsonResponse
    {
        $notification = StudentNotification::query()
            ->where('user_id', $request->user()->id)
            ->findOrFail($id);

        $notification->update(['read_at' => now()]);

        return response()->json([
            'success' => true,
            'message' => 'Notification marked as read.',
        ]);
    }

    public function markAllRead(Request $request): JsonResponse
    {
        StudentNotification::query()
            ->where('user_id', $request->user()->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return response()->json([
            'success' => true,
            'message' => 'All notifications marked as read.',
        ]);
    }
}
