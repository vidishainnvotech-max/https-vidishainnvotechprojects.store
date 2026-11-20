<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserAccess extends Model
{
    protected $table = 'user_access';

    protected $fillable = [
        'user_id',
        'project_id',
        'stage_percent',
    ];

    protected function casts(): array
    {
        return [
            'user_id' => 'integer',
            'project_id' => 'integer',
            'stage_percent' => 'integer',
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
}
