<x-mail::message>
# Payment received

Hello {{ $order->user?->name }},

We received your payment for **{{ $order->project?->title }}**.

**Order:** #{{ $order->id }}  
**Status:** {{ $order->status === 'complete' ? 'Complete – full access unlocked' : 'Partial – next stage unlocked' }}

<x-mail::button :url="rtrim(config('app.frontend_url'), '/') . '/student/orders/' . $order->id">
View order details
</x-mail::button>

Thanks,<br>
Sal Software
</x-mail::message>
