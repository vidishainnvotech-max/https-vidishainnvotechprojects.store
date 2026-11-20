<?php

namespace App\Services;

use App\Models\IotShipment;
use App\Models\Order;
use Illuminate\Support\Str;
use RuntimeException;

class ShipmentService
{
    public const STATUSES = [
        'pending',
        'packed',
        'shipped',
        'in_transit',
        'out_for_delivery',
        'delivered',
        'cancelled',
    ];

    public const TRANSITIONS = [
        'pending' => ['packed', 'cancelled'],
        'packed' => ['shipped', 'cancelled'],
        'shipped' => ['in_transit', 'cancelled'],
        'in_transit' => ['out_for_delivery', 'delivered', 'cancelled'],
        'out_for_delivery' => ['delivered', 'cancelled'],
        'delivered' => [],
        'cancelled' => [],
    ];

    public const PICKUP_TRANSITIONS = [
        'pending' => ['packed', 'cancelled'],
        'packed' => ['delivered', 'cancelled'],
        'delivered' => [],
        'cancelled' => [],
    ];

    public function createForOrder(Order $order, array $delivery): IotShipment
    {
        $order->loadMissing(['project', 'user']);

        if (! $order->project?->is_iot) {
            throw new RuntimeException('Only physical IoT project orders can create shipments.');
        }

        $deliveryMethod = $delivery['delivery_method'] ?? 'delivery';
        $isPickup = $deliveryMethod === 'pickup';

        $shipment = IotShipment::query()->firstOrCreate(
            ['order_id' => $order->id],
            [
                'shipment_number' => 'SHP-'.Str::upper((string) Str::ulid()),
                'user_id' => $order->user_id,
                'project_id' => $order->project_id,
                'kit_price' => $order->project->kit_price ?? 0,
                'quantity' => $delivery['quantity'] ?? 1,
                'delivery_method' => $deliveryMethod,
                'recipient_name' => $delivery['recipient_name'],
                'recipient_phone' => $delivery['recipient_phone'],
                'shipping_address' => $isPickup
                    ? 'Vidisha InnoVTech office pickup'
                    : $delivery['shipping_address'],
                'city' => $isPickup ? 'Not applicable' : $delivery['city'],
                'state' => $isPickup ? 'Not applicable' : $delivery['state'],
                'postal_code' => $isPickup ? 'N/A' : $delivery['postal_code'],
                'country' => $delivery['country'] ?? 'India',
                'status' => 'pending',
            ],
        );

        if ($shipment->wasRecentlyCreated) {
            $shipment->events()->create([
                'status' => 'pending',
                'title' => 'Shipment created',
                'description' => $isPickup
                    ? 'Your physical IoT project order is confirmed for office pickup.'
                    : 'Your physical IoT project order is confirmed and awaiting packing.',
                'occurred_at' => $order->created_at ?? now(),
            ]);
        }

        return $shipment;
    }

    public function statusLabel(string $status): string
    {
        return Str::of($status)->replace('_', ' ')->title()->toString();
    }

    public function fulfillmentStatusLabel(
        IotShipment $shipment,
        string $status
    ): string {
        if ($shipment->delivery_method !== 'pickup') {
            return 'Shipment '.$this->statusLabel($status);
        }

        return match ($status) {
            'pending' => 'Pickup requested',
            'packed' => 'Ready for pickup',
            'delivered' => 'Order picked up',
            'cancelled' => 'Pickup cancelled',
            default => $this->statusLabel($status),
        };
    }

    /**
     * @return array<int, string>
     */
    public function allowedTransitions(IotShipment $shipment): array
    {
        $transitions = $shipment->delivery_method === 'pickup'
            ? self::PICKUP_TRANSITIONS
            : self::TRANSITIONS;

        return $transitions[$shipment->status] ?? [];
    }
}
