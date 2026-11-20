<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Coupon extends Model
{
    use HasFactory;

    protected $fillable = [
        'code',
        'type',
        'value',
        'scope',
        'project_id',
        'source',
        'owner_group_id',
        'created_by',
        'valid_from',
        'valid_until',
        'max_uses',
        'used_count',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'value' => 'decimal:2',
            'valid_from' => 'datetime',
            'valid_until' => 'datetime',
            'max_uses' => 'integer',
            'used_count' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function ownerGroup(): BelongsTo
    {
        return $this->belongsTo(Group::class, 'owner_group_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function redemptions(): HasMany
    {
        return $this->hasMany(CouponRedemption::class);
    }
}
