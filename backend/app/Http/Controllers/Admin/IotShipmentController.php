<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateIotShipmentRequest;
use App\Mail\ShipmentStatusUpdated;
use App\Models\IotShipment;
use App\Services\ShipmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\Rule;
use RuntimeException;

class IotShipmentController extends Controller
{
    public function __construct(private readonly ShipmentService $shipmentService) {}

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'status' => [
                'sometimes',
                'nullable',
                'string',
                Rule::in(ShipmentService::STATUSES),
            ],
            'search' => ['sometimes', 'nullable', 'string', 'max:150'],
            'courier' => ['sometimes', 'nullable', 'string', 'max:100'],
            'order_status' => ['sometimes', 'nullable', Rule::in(['pending', 'partial', 'complete'])],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);

        $query = IotShipment::query()
            ->with([
                'user:id,name,email,mobile',
                'project:id,title',
                'order:id,status,plan_id,total',
                'order.plan:id,name,code,installments',
                'events.updatedBy:id,name',
            ]);

        if (! empty($validated['status'])) {
            $query->where('status', $validated['status']);
        }

        if (! empty($validated['search'])) {
            $search = $validated['search'];

            $query->where(function ($builder) use ($search) {
                $builder
                    ->where('recipient_name', 'like', "%{$search}%")
                    ->orWhere('shipment_number', 'like', "%{$search}%")
                    ->orWhere('recipient_phone', 'like', "%{$search}%")
                    ->orWhere('tracking_number', 'like', "%{$search}%")
                    ->orWhere('city', 'like', "%{$search}%")
                    ->orWhereHas('user', function ($userQuery) use ($search) {
                        $userQuery
                            ->where('name', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%");
                    })
                    ->orWhereHas('project', function ($projectQuery) use ($search) {
                        $projectQuery->where('title', 'like', "%{$search}%");
                    });

                if (ctype_digit($search)) {
                    $builder->orWhere('order_id', (int) $search);
                }
            });
        }

        if (! empty($validated['courier'])) {
            $query->where('courier_name', $validated['courier']);
        }

        if (! empty($validated['order_status'])) {
            $query->whereHas('order', function ($orderQuery) use ($validated) {
                $orderQuery->where('status', $validated['order_status']);
            });
        }

        $shipments = $query
            ->latest('id')
            ->paginate($validated['per_page'] ?? 15);

        return response()->json([
            'success' => true,
            'data' => $shipments,
        ]);
    }

    public function show(int $id): JsonResponse
    {
        $shipment = IotShipment::query()
            ->with([
                'user:id,name,email,mobile',
                'project:id,title,slug,is_iot,kit_price',
                'order:id,user_id,project_id,plan_id,total,status',
                'order.plan:id,name,code,installments,price',
                'events.updatedBy:id,name',
            ])
            ->findOrFail($id);

        return response()->json([
            'success' => true,
            'data' => $shipment,
        ]);
    }

    public function update(UpdateIotShipmentRequest $request, int $id): JsonResponse
    {
        $validated = $request->validated();

        try {
            $result = DB::transaction(function () use ($validated, $id, $request) {
                $shipment = IotShipment::query()
                    ->whereKey($id)
                    ->lockForUpdate()
                    ->firstOrFail();

                $currentStatus = $shipment->status;
                $newStatus = $validated['status'];

                if (
                    $newStatus !== $currentStatus
                    && ! in_array(
                        $newStatus,
                        $this->shipmentService->allowedTransitions($shipment),
                        true
                    )
                ) {
                    throw new RuntimeException(
                        "Shipment status cannot change from {$currentStatus} to {$newStatus}."
                    );
                }

                if (
                    $shipment->delivery_method !== 'pickup'
                    && in_array($newStatus, ['shipped', 'in_transit', 'out_for_delivery', 'delivered'], true)
                    && (
                        empty($validated['tracking_number'])
                        || empty($validated['courier_name'])
                    )
                ) {
                    throw new RuntimeException(
                        'Delivery partner and AWB/tracking number are required before shipping.'
                    );
                }

                $updates = [
                    'status' => $newStatus,
                ];

                foreach ([
                    'tracking_number',
                    'courier_name',
                    'tracking_url',
                    'dispatched_at',
                    'estimated_delivery_date',
                    'delivery_remarks',
                ] as $field) {
                    if (array_key_exists($field, $validated)) {
                        $updates[$field] = $validated[$field];
                    }
                }

                if (
                    $newStatus === 'shipped'
                    && $currentStatus !== 'shipped'
                    && empty($updates['dispatched_at'])
                ) {
                    $updates['dispatched_at'] = now();
                }

                if (
                    $newStatus === 'delivered'
                    && $currentStatus !== 'delivered'
                ) {
                    if (
                        $shipment->delivery_method !== 'pickup'
                        && ! $shipment->dispatched_at
                    ) {
                        throw new RuntimeException(
                            'A shipment must be dispatched before it can be delivered.'
                        );
                    }

                    $updates['delivered_at'] = now();
                }

                $shipment->update($updates);

                $statusChanged = $newStatus !== $currentStatus;
                $metadataChanged = collect($updates)
                    ->except('status')
                    ->contains(fn ($value, $field) => $shipment->wasChanged($field));

                if ($statusChanged || $metadataChanged) {
                    $shipment->events()->create([
                        'updated_by' => $request->user()->id,
                        'status' => $newStatus,
                        'title' => $statusChanged
                            ? $this->shipmentService->fulfillmentStatusLabel(
                                $shipment,
                                $newStatus
                            )
                            : 'Shipment details updated',
                        'description' => $validated['delivery_remarks'] ?? null,
                        'occurred_at' => now(),
                    ]);
                }

                return [
                    'shipment' => $shipment->fresh()->load([
                        'user:id,name,email,mobile',
                        'project:id,title',
                        'order:id,status,plan_id,total',
                        'order.plan:id,name,code,installments',
                        'events.updatedBy:id,name',
                    ]),
                    'status_changed' => $statusChanged,
                    'metadata_changed' => $metadataChanged,
                ];
            });

            $shipment = $result['shipment'];

            $emailStatuses = $shipment->delivery_method === 'pickup'
                ? ['packed', 'delivered']
                : ['packed', 'shipped', 'out_for_delivery', 'delivered'];

            $shouldEmail = ($result['status_changed'] || $result['metadata_changed'])
                && in_array($shipment->status, $emailStatuses, true);

            if ($shouldEmail && $shipment->user?->email) {
                try {
                    Mail::to($shipment->user->email)->send(new ShipmentStatusUpdated($shipment));
                } catch (\Throwable $exception) {
                    report($exception);
                }
            }

            return response()->json([
                'success' => true,
                'message' => 'Shipment updated successfully.',
                'data' => $shipment,
            ]);
        } catch (RuntimeException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }
    }
}
