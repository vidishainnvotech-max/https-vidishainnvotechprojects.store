<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class IotShipment extends Model
{
    protected $fillable = [
        'user_id',
        'shipment_number',
        'project_id',
        'order_id',
        'kit_price',
        'quantity',
        'delivery_method',
        'recipient_name',
        'recipient_phone',
        'shipping_address',
        'city',
        'state',
        'postal_code',
        'country',
        'status',
        'tracking_number',
        'courier_name',
        'tracking_url',
        'dispatched_at',
        'estimated_delivery_date',
        'delivery_remarks',
        'delivered_at',
    ];

    protected function casts(): array
    {
        return [
            'kit_price' => 'decimal:2',
            'quantity' => 'integer',
            'dispatched_at' => 'datetime',
            'estimated_delivery_date' => 'date',
            'delivered_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function events(): HasMany
    {
        return $this->hasMany(IotShipmentEvent::class)->oldest('occurred_at');
    }
}
