<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class IotShipmentEvent extends Model
{
    protected $fillable = [
        'iot_shipment_id',
        'updated_by',
        'status',
        'title',
        'description',
        'occurred_at',
    ];

    protected function casts(): array
    {
        return ['occurred_at' => 'datetime'];
    }

    public function shipment(): BelongsTo
    {
        return $this->belongsTo(IotShipment::class, 'iot_shipment_id');
    }

    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
