<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Services\InvoicePdfService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class OrderController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'status' => [
                'nullable',
                'in:pending,partial,complete',
            ],
            'search' => ['nullable', 'string', 'max:100'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $orders = Order::query()
            ->with([
                'user:id,name,email',
                'project:id,title,offer_price,cut_price',
                'plan:id,name,code,price',
            ])
            ->when(
                $validated['status'] ?? null,
                fn ($query, $status) => $query->where('status', $status)
            )
            ->when(
                $validated['search'] ?? null,
                function ($query, $search) {
                    $query->where(function ($subquery) use ($search) {
                        $subquery
                            ->whereHas('user', function ($userQuery) use ($search) {
                                $userQuery
                                    ->where('name', 'like', "%{$search}%")
                                    ->orWhere('email', 'like', "%{$search}%");
                            })
                            ->orWhereHas('project', function ($projectQuery) use ($search) {
                                $projectQuery->where('title', 'like', "%{$search}%");
                            });

                        if (ctype_digit($search)) {
                            $subquery->orWhere('id', (int) $search);
                        }
                    });
                }
            )
            ->latest('id')
            ->paginate($validated['per_page'] ?? 15);

        return response()->json([
            'success' => true,
            'data' => $orders,
        ]);
    }

    public function show(int $id): JsonResponse
    {
        $order = Order::query()
            ->with([
                'user:id,name,email,mobile',
                'project:id,title,project_type,offer_price,cut_price',
                'plan:id,name,code,price,installments',
                'payments:id,order_id,installment_no,amount,status,paid_at',
                'coupon:id,code,type,value',
                'shipment.events.updatedBy:id,name',
            ])
            ->findOrFail($id);

        return response()->json([
            'success' => true,
            'data' => $order,
        ]);
    }

    public function invoice(int $id, InvoicePdfService $invoices): Response
    {
        $order = Order::query()->findOrFail($id);
        $filename = 'invoice-order-'.$order->id.'.pdf';

        return response($invoices->make($order), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
            'Cache-Control' => 'private, no-store, max-age=0',
        ]);
    }
}
