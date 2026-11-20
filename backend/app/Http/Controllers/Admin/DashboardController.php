<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Group;
use App\Models\Order;
use App\Models\Project;
use Illuminate\Http\JsonResponse;

class DashboardController extends Controller
{
    public function index(): JsonResponse
    {
        $recentOrders = Order::with([
            'user:id,name,email',
            'project:id,title',
        ])
            ->latest()
            ->limit(5)
            ->get()
            ->map(fn (Order $order) => [
                'id' => $order->id,
                'student_name' => $order->user?->name ?? 'Unknown',
                'student_email' => $order->user?->email,
                'project_name' => $order->project?->title ?? 'Unknown project',
                'amount' => $order->total,
                'status' => $order->status,
                'created_at' => $order->created_at,
            ]);

        return response()->json([
            'success' => true,
            'data' => [
                'groups' => Group::count(),
                'projects' => Project::where(
                    'project_type',
                    'standard'
                )->count(),
                'mini_projects' => Project::where(
                    'project_type',
                    'diploma_mini'
                )->count(),
                'active_projects' => Project::where(
                    'is_active',
                    true
                )->count(),
                'orders' => Order::count(),
                'completed_orders' => Order::where(
                    'status',
                    'complete'
                )->count(),
                'pending_orders' => Order::where('status', 'pending')->count(),
                'partial_orders' => Order::where('status', 'partial')->count(),
                'complete_orders' => Order::where('status', 'complete')->count(),
                'recent_orders' => $recentOrders,
            ],
        ]);
    }
}
