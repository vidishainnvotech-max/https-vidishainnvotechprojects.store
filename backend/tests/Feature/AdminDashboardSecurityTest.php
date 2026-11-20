<?php

namespace Tests\Feature;

use App\Models\College;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminDashboardSecurityTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_cannot_access_admin_dashboard(): void
    {
        $this->getJson('/api/admin/dashboard')
            ->assertUnauthorized();
    }

    public function test_student_cannot_access_admin_dashboard(): void
    {
        $college = College::create([
            'name' => 'Test College',
        ]);

        $student = User::factory()->create([
            'mobile' => '9876543210',
            'college_id' => $college->id,
            'role' => 'student',
        ]);

        $this->actingAs($student)
            ->getJson('/api/admin/dashboard')
            ->assertForbidden();
    }
}
