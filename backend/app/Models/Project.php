<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Project extends Model
{
    protected $fillable = [
        'category_id',
        'title',
        'slug',
        'abstract',
        'is_iot',
        'iot_kit_link',
        'kit_price',
        'image',
        'project_type',
        'level',
        'cut_price',
        'offer_price',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_iot' => 'boolean',
            'kit_price' => 'decimal:2',
            'cut_price' => 'decimal:2',
            'offer_price' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function stages(): HasMany
    {
        return $this->hasMany(ProjectStage::class);
    }

    public function documents(): HasMany
    {
        return $this->hasMany(ProjectDocument::class);
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    public function userAccess(): HasMany
    {
        return $this->hasMany(UserAccess::class);
    }

    public function projectFiles(): HasMany
    {
        return $this->hasMany(ProjectFile::class);
    }

    public function completeProjectFile(): HasOne
    {
        return $this->hasOne(ProjectFile::class)
            ->where('type', ProjectFile::TYPE_COMPLETE_ZIP)
            ->where('is_active', true);
    }
}
