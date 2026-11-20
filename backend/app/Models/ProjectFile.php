<?php

namespace App\Models;

use Database\Factories\ProjectFileFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProjectFile extends Model
{
    /** @use HasFactory<ProjectFileFactory> */
    use HasFactory;

    public const TYPE_STAGE_ZIP = 'stage_zip';

    public const TYPE_COMPLETE_ZIP = 'complete_zip';

    protected $fillable = [
        'project_id',
        'project_stage_id',
        'type',
        'original_name',
        'storage_path',
        'size',
        'mime_type',
        'sha256',
        'is_active',
        'uploaded_by',
    ];

    protected $hidden = [
        'storage_path',
    ];

    protected function casts(): array
    {
        return [
            'project_id' => 'integer',
            'project_stage_id' => 'integer',
            'size' => 'integer',
            'is_active' => 'boolean',
            'uploaded_by' => 'integer',
        ];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function projectStage(): BelongsTo
    {
        return $this->belongsTo(ProjectStage::class);
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
