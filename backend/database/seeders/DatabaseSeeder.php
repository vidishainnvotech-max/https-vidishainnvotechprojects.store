<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    public function run(): void
    {
        User::factory()->create([
            'name' => 'Test User',
            'email' => 'test@example.com',
        ]);

        User::updateOrCreate(
            ['email' => 'admin@vidishainnvotech.com'],
            [
                'name' => 'Administrator',
                'password' => Hash::make('Admin@2026'),
                'role' => 'admin',
            ],
        );

        $this->call([
            CollegeSeeder::class,
            PlanSeeder::class,
        ]);
    }
}
