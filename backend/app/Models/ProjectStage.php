<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class ProjectStage extends Model
{
    protected $fillable = [
        'project_id',
        'stage_percent',
        'semester',
        'video_url',
        'ppt_path',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function sourceFile(): HasOne
    {
        return $this->hasOne(ProjectFile::class)
            ->where('type', ProjectFile::TYPE_STAGE_ZIP)
            ->where('is_active', true);
    }
}
