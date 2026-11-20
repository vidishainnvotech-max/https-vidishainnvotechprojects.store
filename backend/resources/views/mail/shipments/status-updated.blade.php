<x-mail::message>
# {{ $shipment->delivery_method === 'pickup'
    ? 'Your kit is ready for pickup'
    : match ($shipment->status) {
        'packed' => 'Your kit has been packed',
        'out_for_delivery' => 'Your kit is out for delivery',
        'delivered' => 'Your kit has been delivered',
        default => 'Your kit is on the way',
    } }}

Hello {{ $shipment->recipient_name }},

@if ($shipment->delivery_method === 'pickup')
Your **{{ $shipment->project?->title }}** kit is packed and ready to collect from the Sal Software office.

Please wait for any additional pickup instructions in the delivery remarks, and bring a valid identification document when collecting the kit.
@else
Your **{{ $shipment->project?->title }}** kit has been shipped.

@if ($shipment->courier_name)
- **Delivery partner:** {{ $shipment->courier_name }}
@endif
@if ($shipment->tracking_number)
- **AWB / tracking number:** {{ $shipment->tracking_number }}
@endif
@if ($shipment->estimated_delivery_date)
- **Estimated delivery:** {{ $shipment->estimated_delivery_date->format('d M Y') }}
@endif

@if ($shipment->tracking_url)
<x-mail::button :url="$shipment->tracking_url">
Track your shipment
</x-mail::button>
@endif
@endif

**Order:** #{{ $shipment->order_id }}  
**Reference:** {{ $shipment->shipment_number }}

@if ($shipment->delivery_remarks)
**Remarks:** {{ $shipment->delivery_remarks }}
@endif

<x-mail::button :url="rtrim(config('app.frontend_url'), '/') . '/student/orders/' . $shipment->order_id">
View order details
</x-mail::button>

Thanks,<br>
Sal Software
</x-mail::message>
