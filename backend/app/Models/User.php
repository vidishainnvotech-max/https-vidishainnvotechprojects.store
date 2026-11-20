<?php

namespace App\Models;

use Illuminate\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable implements \Illuminate\Contracts\Auth\MustVerifyEmail
{
    use HasApiTokens, HasFactory, MustVerifyEmail, Notifiable;

    protected $fillable = [
        'name',
        'email',
        'mobile',
        'college_id',
        'group_id',
        'password',
        'role',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    public function studentNotifications(): HasMany
    {
        return $this->hasMany(StudentNotification::class);
    }

    public function userAccess(): HasMany
    {
        return $this->hasMany(UserAccess::class);
    }

    public function group(): BelongsTo
    {
        return $this->belongsTo(Group::class);
    }

    public function uploadedProjectFiles(): HasMany
    {
        return $this->hasMany(ProjectFile::class, 'uploaded_by');
    }
}
