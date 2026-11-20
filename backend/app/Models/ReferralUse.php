<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReferralUse extends Model
{
    use HasFactory;

    protected $fillable = [
        'referral_code_id',
        'referrer_group_id',
        'referred_group_id',
        'qualified_order_id',
        'status',
        'qualified_at',
    ];

    protected function casts(): array
    {
        return [
            'qualified_at' => 'datetime',
        ];
    }

    public function referralCode(): BelongsTo
    {
        return $this->belongsTo(ReferralCode::class);
    }

    public function referrerGroup(): BelongsTo
    {
        return $this->belongsTo(Group::class, 'referrer_group_id');
    }

    public function referredGroup(): BelongsTo
    {
        return $this->belongsTo(Group::class, 'referred_group_id');
    }

    public function qualifiedOrder(): BelongsTo
    {
        return $this->belongsTo(Order::class, 'qualified_order_id');
    }
}
