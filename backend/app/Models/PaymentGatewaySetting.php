<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PaymentGatewaySetting extends Model
{
    protected $fillable = [
        'provider',
        'mode',
        'test_key_id',
        'test_key_secret',
        'live_key_id',
        'live_key_secret',
        'updated_by',
    ];

    protected $hidden = [
        'test_key_id',
        'test_key_secret',
        'live_key_id',
        'live_key_secret',
    ];

    protected function casts(): array
    {
        return [
            'test_key_id' => 'encrypted',
            'test_key_secret' => 'encrypted',
            'live_key_id' => 'encrypted',
            'live_key_secret' => 'encrypted',
        ];
    }

    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public function credentialsFor(string $mode): ?array
    {
        if (! in_array($mode, ['test', 'live'], true)) {
            return null;
        }

        $keyId = $this->getAttribute("{$mode}_key_id");
        $keySecret = $this->getAttribute("{$mode}_key_secret");

        if (! is_string($keyId) || $keyId === '' || ! is_string($keySecret) || $keySecret === '') {
            return null;
        }

        return ['key_id' => $keyId, 'key_secret' => $keySecret];
    }

    public function activeCredentials(): ?array
    {
        return $this->credentialsFor($this->mode);
    }
}
