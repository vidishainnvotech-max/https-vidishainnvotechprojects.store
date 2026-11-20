<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GroupMember extends Model
{
    use HasFactory;

    protected $fillable = [
        'group_id',
        'name',
        'email',
        'student_id',
        'mobile',
        'is_leader',
    ];

    protected function casts(): array
    {
        return [
            'is_leader' => 'boolean',
        ];
    }

    public function group(): BelongsTo
    {
        return $this->belongsTo(Group::class);
    }
}
