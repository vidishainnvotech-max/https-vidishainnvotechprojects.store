<?php

namespace Tests\Feature\Student;

use App\Models\Category;
use App\Models\DocumentationTemplate;
use App\Models\Project;
use App\Models\ProjectDocument;
use App\Models\ProjectStage;
use App\Models\User;
use App\Models\UserAccess;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ProjectStageEntitlementTest extends TestCase
{
    use RefreshDatabase;

    public function test_project_response_unlocks_only_explicitly_granted_stages(): void
    {
        $student = $this->createStudent();
        $project = $this->createProject('exact-stage-response');
        $this->createStages($project);
        $this->grantStages($student, $project, [50, 100]);

        $response = $this->actingAs($student)
            ->getJson("/api/my-projects/{$project->id}");

        $response->assertOk()
            ->assertJsonPath('data.access_stages', [50, 100])
            ->assertJsonPath('data.highest_stage', 100);

        $stages = collect($response->json('data.stages'))
            ->keyBy(fn (array $stage): int => (int) $stage['stage_percent']);

        $this->assertFalse((bool) $stages->get(20)['is_unlocked']);
        $this->assertTrue((bool) $stages->get(50)['is_unlocked']);
        $this->assertFalse((bool) $stages->get(75)['is_unlocked']);
        $this->assertTrue((bool) $stages->get(100)['is_unlocked']);
    }

    public function test_presentation_download_returns_403_for_ungranted_lower_stage(): void
    {
        Storage::fake('local');

        $student = $this->createStudent();
        $project = $this->createProject('exact-stage-ppt');
        $stages = $this->createStages($project, true);
        $this->grantStages($student, $project, [50, 100]);
        Storage::disk('local')->put($stages[20]->ppt_path, 'stage-20');
        Storage::disk('local')->put($stages[50]->ppt_path, 'stage-50');

        $this->actingAs($student)
            ->get("/api/download/ppt/{$stages[20]->id}")
            ->assertForbidden();

        $this->actingAs($student)
            ->get("/api/download/ppt/{$stages[50]->id}")
            ->assertOk();
    }

    public function test_presentation_download_returns_403_for_another_project(): void
    {
        Storage::fake('local');

        $student = $this->createStudent();
        $ownedProject = $this->createProject('owned-stage-project');
        $otherProject = $this->createProject('other-stage-project');
        $otherStages = $this->createStages($otherProject, true);
        $this->grantStages($student, $ownedProject, [50]);
        Storage::disk('local')->put($otherStages[50]->ppt_path, 'stage-50');

        $this->actingAs($student)
            ->get("/api/download/ppt/{$otherStages[50]->id}")
            ->assertForbidden();
    }

    public function test_project_documents_and_videos_require_the_exact_stage(): void
    {
        Storage::fake('local');

        $student = $this->createStudent();
        $project = $this->createProject('exact-stage-content');
        $stages = $this->createStages($project);
        $this->grantStages($student, $project, [50, 100]);

        $stages[20]->update(['video_url' => 'https://example.com/stage-20']);
        $stages[50]->update(['video_url' => 'https://example.com/stage-50']);

        $stageTwentyDocument = ProjectDocument::create([
            'project_id' => $project->id,
            'bundle' => 'stage-files',
            'stage_percent' => 20,
            'file_path' => "projects/{$project->id}/document-20.pdf",
        ]);
        $stageFiftyDocument = ProjectDocument::create([
            'project_id' => $project->id,
            'bundle' => 'stage-files',
            'stage_percent' => 50,
            'file_path' => "projects/{$project->id}/document-50.pdf",
        ]);

        Storage::disk('local')->put($stageTwentyDocument->file_path, 'stage-20');
        Storage::disk('local')->put($stageFiftyDocument->file_path, 'stage-50');

        $this->actingAs($student)
            ->get("/api/download/document/{$stageTwentyDocument->id}")
            ->assertForbidden();

        $this->actingAs($student)
            ->get("/api/download/document/{$stageFiftyDocument->id}")
            ->assertOk();

        $this->actingAs($student)
            ->getJson("/api/stage/{$stages[20]->id}/video")
            ->assertForbidden();

        $this->actingAs($student)
            ->getJson("/api/stage/{$stages[50]->id}/video")
            ->assertOk()
            ->assertJsonPath('data.video_url', 'https://example.com/stage-50');
    }

    public function test_documentation_uses_exact_stage_entitlements(): void
    {
        Storage::fake('local');

        $student = $this->createStudent();
        $project = $this->createProject('exact-stage-documentation');
        $this->grantStages($student, $project, [50, 100]);
        $stageTwentyDocument = $this->createDocumentation($project, 20);
        $stageFiftyDocument = $this->createDocumentation($project, 50);
        Storage::disk('local')->put($stageTwentyDocument->file_path, 'stage-20');
        Storage::disk('local')->put($stageFiftyDocument->file_path, 'stage-50');

        $response = $this->actingAs($student)
            ->getJson('/api/student/documentation-templates');

        $response->assertOk();

        $documents = collect($response->json('data'))
            ->keyBy(fn (array $document): int => (int) $document['stage_percent']);

        $this->assertFalse((bool) $documents->get(20)['is_unlocked']);
        $this->assertNull($documents->get(20)['download_url']);
        $this->assertTrue((bool) $documents->get(50)['is_unlocked']);

        $this->actingAs($student)
            ->get("/api/student/documentation-templates/{$stageTwentyDocument->id}/download")
            ->assertForbidden();

        $this->actingAs($student)
            ->get("/api/student/documentation-templates/{$stageFiftyDocument->id}/download")
            ->assertOk();
    }

    private function createStudent(): User
    {
        return User::factory()->create([
            'mobile' => '9000000001',
            'college_id' => 'test-college',
            'role' => 'student',
        ]);
    }

    private function createProject(string $slug): Project
    {
        $category = Category::create([
            'name' => 'Category '.$slug,
            'slug' => 'category-'.$slug,
        ]);

        return Project::create([
            'category_id' => $category->id,
            'title' => 'Project '.$slug,
            'slug' => $slug,
            'abstract' => 'Exact entitlement test project.',
            'is_iot' => false,
            'is_active' => true,
        ]);
    }

    /**
     * @return array<int, ProjectStage>
     */
    private function createStages(Project $project, bool $withPpt = false): array
    {
        $stages = [];

        foreach ([20, 50, 75, 100] as $stagePercent) {
            $stages[$stagePercent] = ProjectStage::create([
                'project_id' => $project->id,
                'stage_percent' => $stagePercent,
                'semester' => 'Stage '.$stagePercent,
                'ppt_path' => $withPpt
                    ? "projects/{$project->id}/stage-{$stagePercent}.pptx"
                    : null,
            ]);
        }

        return $stages;
    }

    /**
     * @param  array<int>  $stagePercents
     */
    private function grantStages(
        User $student,
        Project $project,
        array $stagePercents
    ): void {
        foreach ($stagePercents as $stagePercent) {
            UserAccess::create([
                'user_id' => $student->id,
                'project_id' => $project->id,
                'stage_percent' => $stagePercent,
            ]);
        }
    }

    private function createDocumentation(
        Project $project,
        int $stagePercent
    ): DocumentationTemplate {
        return DocumentationTemplate::create([
            'project_id' => $project->id,
            'stage_percent' => $stagePercent,
            'title' => "Stage {$stagePercent} Documentation",
            'file_path' => "projects/{$project->id}/documentation-{$stagePercent}.pdf",
            'file_type' => 'pdf',
            'is_active' => true,
        ]);
    }
}
