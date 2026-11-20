<?php

namespace App\Http\Controllers\Student;

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
        $orders = Order::query()
            ->whereBelongsTo($request->user())
            ->with([
                'project:id,title,slug,image,is_iot,project_type',
                'plan:id,name,code,installments',
                'payments:id,order_id,installment_no,amount,status,paid_at',
                'shipment.events.updatedBy:id,name',
            ])
            ->latest('id')
            ->paginate(20);

        return response()->json([
            'success' => true,
            'data' => $orders,
        ]);
    }

    public function show(Request $request, Order $order): JsonResponse
    {
        if ((int) $order->user_id !== (int) $request->user()->id) {
            return response()->json([
                'success' => false,
                'message' => 'Order not found.',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $order->load([
                'project:id,title,slug,image,is_iot,project_type',
                'plan:id,name,code,installments',
                'payments:id,order_id,installment_no,amount,status,paid_at',
                'shipment.events.updatedBy:id,name',
            ]),
        ]);
    }

    public function invoice(Request $request, Order $order, InvoicePdfService $invoices): Response|JsonResponse
    {
        if ((int) $order->user_id !== (int) $request->user()->id) {
            return response()->json([
                'success' => false,
                'message' => 'Order not found.',
            ], 404);
        }

        $filename = 'invoice-order-'.$order->id.'.pdf';

        return response($invoices->make($order), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
            'Cache-Control' => 'private, no-store, max-age=0',
        ]);
    }
}
