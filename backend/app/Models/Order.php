<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Order extends Model
{
    protected $fillable = [
        'user_id',
        'project_id',
        'plan_id',
        'base_price',
        'total',
        'status',
        'coupon_id',
        'discount_amount',
    ];

    protected function casts(): array
    {
        return [
            'base_price' => 'decimal:2',
            'total' => 'decimal:2',
            'discount_amount' => 'decimal:2',
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

    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function coupon(): BelongsTo
    {
        return $this->belongsTo(Coupon::class);
    }

    public function couponRedemption(): HasOne
    {
        return $this->hasOne(CouponRedemption::class);
    }

    public function referralQualification(): HasOne
    {
        return $this->hasOne(
            ReferralUse::class,
            'qualified_order_id'
        );
    }

    public function shipment(): HasOne
    {
        return $this->hasOne(IotShipment::class);
    }
}
