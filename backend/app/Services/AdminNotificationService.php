<?php

namespace App\Services;

use App\Models\AdminNotification;
use App\Models\User;

class AdminNotificationService
{
    public static function notifyAdmins(
        string $type,
        string $title,
        string $message,
        ?string $url = null
    ): void {
        try {
            $admins = User::where('role', 'admin')->get();

            foreach ($admins as $admin) {
                $exists = AdminNotification::where('admin_id', $admin->id)
                    ->where('type', $type)
                    ->where('title', $title)
                    ->exists();

                if (! $exists) {
                    AdminNotification::create([
                        'admin_id' => $admin->id,
                        'type' => $type,
                        'title' => $title,
                        'message' => $message,
                        'url' => $url,
                    ]);
                }
            }
        } catch (\Throwable) {
        }
    }
}
