<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DocumentationTemplate extends Model
{
    use HasFactory;

    protected $fillable = [
        'college_id',
        'group_id',
        'project_id',
        'stage_percent',
        'bundle',
        'title',
        'description',
        'file_path',
        'file_type',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'college_id' => 'integer',
            'group_id' => 'integer',
            'project_id' => 'integer',
            'stage_percent' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    public function college(): BelongsTo
    {
        return $this->belongsTo(College::class);
    }

    public function group(): BelongsTo
    {
        return $this->belongsTo(Group::class);
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }
}
