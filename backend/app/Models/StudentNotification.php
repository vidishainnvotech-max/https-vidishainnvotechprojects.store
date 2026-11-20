<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StudentNotification extends Model
{
    protected $fillable = [
        'user_id',
        'notification_key',
        'type',
        'title',
        'message',
        'url',
        'occurred_at',
        'read_at',
    ];

    protected function casts(): array
    {
        return [
            'occurred_at' => 'datetime',
            'read_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
