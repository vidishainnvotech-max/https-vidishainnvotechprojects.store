<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdminNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminNotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $adminId = $request->user()->id;

        return response()->json([
            'success' => true,
            'unread_count' => AdminNotification::where('admin_id', $adminId)
                ->whereNull('read_at')->count(),
            'data' => AdminNotification::where('admin_id', $adminId)
                ->latest()->limit(20)->get(),
        ]);
    }

    public function markRead(Request $request, int $id): JsonResponse
    {
        $notification = AdminNotification::where('admin_id', $request->user()->id)
            ->findOrFail($id);

        $notification->update(['read_at' => now()]);

        return response()->json([
            'success' => true,
            'message' => 'Notification marked as read.',
        ]);
    }

    public function markAllRead(Request $request): JsonResponse
    {
        AdminNotification::where('admin_id', $request->user()->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return response()->json([
            'success' => true,
            'message' => 'All notifications marked as read.',
        ]);
    }
}
