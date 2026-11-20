<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Group extends Model
{
    use HasFactory;

    protected $fillable = [
        'college_id',
        'member_count',
        'pincode',
        'whatsapp',
        'guide_name',
        'guide_mobile',
        'second_guide_name',
        'second_guide_mobile',
    ];

    protected function casts(): array
    {
        return [
            'member_count' => 'integer',
        ];
    }

    public function college(): BelongsTo
    {
        return $this->belongsTo(College::class);
    }

    public function members(): HasMany
    {
        return $this->hasMany(GroupMember::class);
    }

    public function leaderUser(): HasOne
    {
        return $this->hasOne(User::class, 'group_id', 'id');
    }

    public function referralCode(): HasOne
    {
        return $this->hasOne(ReferralCode::class);
    }

    public function referralUsesSent(): HasMany
    {
        return $this->hasMany(
            ReferralUse::class,
            'referrer_group_id'
        );
    }

    public function referralAttribution(): HasOne
    {
        return $this->hasOne(
            ReferralUse::class,
            'referred_group_id'
        );
    }

    public function rewardCoupons(): HasMany
    {
        return $this->hasMany(
            Coupon::class,
            'owner_group_id'
        );
    }
}
