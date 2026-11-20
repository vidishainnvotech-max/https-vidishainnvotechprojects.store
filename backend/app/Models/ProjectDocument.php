<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProjectDocument extends Model
{
    protected $fillable = [
        'project_id',
        'bundle',
        'stage_percent',
        'semester',
        'file_path',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }
}
