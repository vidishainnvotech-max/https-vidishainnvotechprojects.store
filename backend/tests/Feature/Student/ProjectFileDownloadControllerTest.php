<?php

namespace Tests\Feature\Student;

use App\Models\Category;
use App\Models\Project;
use App\Models\ProjectFile;
use App\Models\ProjectStage;
use App\Models\User;
use App\Models\UserAccess;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ProjectFileDownloadControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_returns_401_when_no_token_is_provided(): void
    {
        $project = $this->createProject('unauthenticated');
        $file = ProjectFile::factory()->for($project)->create();

        $this->get("/api/project-files/{$file->id}/download")
            ->assertUnauthorized();
    }

    public function test_returns_403_for_stage_zip_without_exact_entitlement(): void
    {
        Storage::fake('local');

        $student = $this->createStudent();
        $project = $this->createProject('wrong-stage');
        $stageTwenty = $this->createStage($project, 20);
        $file = $this->createStageFile($project, $stageTwenty, 'stage-20.zip');
        $this->grantStage($student, $project, 50);
        Storage::disk('local')->put($file->storage_path, 'stage-20-source');

        $this->actingAs($student, 'sanctum')
            ->get("/api/project-files/{$file->id}/download")
            ->assertForbidden();
    }

    public function test_downloads_stage_zip_for_exact_entitlement(): void
    {
        Storage::fake('local');

        $student = $this->createStudent();
        $project = $this->createProject('exact-stage');
        $stageFifty = $this->createStage($project, 50);
        $file = $this->createStageFile($project, $stageFifty, 'stage-50.zip');
        $this->grantStage($student, $project, 50);
        Storage::disk('local')->put($file->storage_path, 'stage-50-source');

        $response = $this->actingAs($student, 'sanctum')
            ->get("/api/project-files/{$file->id}/download");

        $response->assertOk()->assertDownload('stage-50.zip');
        $this->assertSame('stage-50-source', $response->streamedContent());
    }

    public function test_returns_403_when_student_guesses_file_for_unpurchased_project(): void
    {
        Storage::fake('local');

        $student = $this->createStudent();
        $ownedProject = $this->createProject('owned-project');
        $otherProject = $this->createProject('other-project');
        $otherStage = $this->createStage($otherProject, 50);
        $file = $this->createStageFile($otherProject, $otherStage, 'other.zip');
        $this->grantStage($student, $ownedProject, 50);
        Storage::disk('local')->put($file->storage_path, 'other-source');

        $this->actingAs($student, 'sanctum')
            ->get("/api/project-files/{$file->id}/download")
            ->assertForbidden();
    }

    public function test_returns_403_for_complete_zip_without_bundle_entitlement(): void
    {
        Storage::fake('local');

        $student = $this->createStudent();
        $project = $this->createProject('complete-locked');
        $file = $this->createCompleteFile($project, 'complete-locked.zip');
        $this->grantStage($student, $project, 100);
        Storage::disk('local')->put($file->storage_path, 'complete-source');

        $this->actingAs($student, 'sanctum')
            ->get("/api/project-files/{$file->id}/download")
            ->assertForbidden();
    }

    public function test_downloads_complete_zip_with_bundle_entitlement(): void
    {
        Storage::fake('local');

        $student = $this->createStudent();
        $project = $this->createProject('complete-unlocked');
        $file = $this->createCompleteFile($project, 'complete-project.zip');
        $this->grantCompleteBundle($student, $project);
        Storage::disk('local')->put($file->storage_path, 'complete-source');

        $response = $this->actingAs($student, 'sanctum')
            ->get("/api/project-files/{$file->id}/download");

        $response->assertOk()->assertDownload('complete-project.zip');
        $this->assertSame('complete-source', $response->streamedContent());
    }

    public function test_returns_404_for_inactive_zip(): void
    {
        $student = $this->createStudent();
        $project = $this->createProject('inactive-file');
        $stage = $this->createStage($project, 50);
        $file = $this->createStageFile($project, $stage, 'inactive.zip', false);
        $this->grantStage($student, $project, 50);

        $this->actingAs($student, 'sanctum')
            ->get("/api/project-files/{$file->id}/download")
            ->assertNotFound();
    }

    public function test_returns_404_when_private_zip_is_missing(): void
    {
        Storage::fake('local');

        $student = $this->createStudent();
        $project = $this->createProject('missing-file');
        $stage = $this->createStage($project, 50);
        $file = $this->createStageFile($project, $stage, 'missing.zip');
        $this->grantStage($student, $project, 50);

        $this->actingAs($student, 'sanctum')
            ->get("/api/project-files/{$file->id}/download")
            ->assertNotFound();
    }

    public function test_project_response_exposes_only_authorized_zip_metadata(): void
    {
        $student = $this->createStudent();
        $project = $this->createProject('response-metadata');
        $stageTwenty = $this->createStage($project, 20);
        $stageFifty = $this->createStage($project, 50);
        $this->createStageFile($project, $stageTwenty, 'stage-20.zip');
        $stageFiftyFile = $this->createStageFile(
            $project,
            $stageFifty,
            'stage-50.zip'
        );
        $completeFile = $this->createCompleteFile($project, 'complete.zip');
        $this->grantStage($student, $project, 50);
        $this->grantCompleteBundle($student, $project);

        $response = $this->actingAs($student, 'sanctum')
            ->getJson("/api/my-projects/{$project->id}")
            ->assertOk();

        $stages = collect($response->json('data.stages'))
            ->keyBy(fn (array $stage): int => (int) $stage['stage_percent']);
        $stageTwentyData = $stages->get(20);
        $stageFiftyData = $stages->get(50);

        $this->assertTrue((bool) $stageTwentyData['has_zip']);
        $this->assertNull($stageTwentyData['source_zip']);
        $this->assertTrue((bool) $stageFiftyData['has_zip']);
        $this->assertSame(
            'stage-50.zip',
            $stageFiftyData['source_zip']['original_name']
        );
        $this->assertStringEndsWith(
            "/api/project-files/{$stageFiftyFile->id}/download",
            $stageFiftyData['source_zip']['download_url']
        );

        $completeProject = $response->json('data.complete_project');
        $this->assertTrue((bool) $completeProject['is_unlocked']);
        $this->assertTrue((bool) $completeProject['has_zip']);
        $this->assertSame(
            'complete.zip',
            $completeProject['source_zip']['original_name']
        );
        $this->assertStringEndsWith(
            "/api/project-files/{$completeFile->id}/download",
            $completeProject['source_zip']['download_url']
        );
        $this->assertStringNotContainsString(
            'storage_path',
            $response->getContent()
        );
    }

    private function createStudent(): User
    {
        return User::factory()->create([
            'mobile' => '9000000020',
            'college_id' => 'project-file-download-college',
            'role' => 'student',
        ]);
    }

    private function createProject(string $suffix): Project
    {
        $category = Category::create([
            'name' => 'Download Category '.$suffix,
            'slug' => 'download-category-'.$suffix,
        ]);

        return Project::create([
            'category_id' => $category->id,
            'title' => 'Download Project '.$suffix,
            'slug' => 'download-project-'.$suffix,
            'abstract' => 'Project used to verify protected ZIP downloads.',
            'is_iot' => false,
            'is_active' => true,
        ]);
    }

    private function createStage(
        Project $project,
        int $stagePercent
    ): ProjectStage {
        return ProjectStage::create([
            'project_id' => $project->id,
            'stage_percent' => $stagePercent,
            'semester' => 'Stage '.$stagePercent,
        ]);
    }

    private function createStageFile(
        Project $project,
        ProjectStage $stage,
        string $originalName,
        bool $isActive = true
    ): ProjectFile {
        return ProjectFile::factory()
            ->for($project)
            ->stage($stage)
            ->create([
                'original_name' => $originalName,
                'is_active' => $isActive,
            ]);
    }

    private function createCompleteFile(
        Project $project,
        string $originalName
    ): ProjectFile {
        return ProjectFile::factory()
            ->for($project)
            ->create(['original_name' => $originalName]);
    }

    private function grantStage(
        User $student,
        Project $project,
        int $stagePercent
    ): void {
        UserAccess::create([
            'user_id' => $student->id,
            'project_id' => $project->id,
            'stage_percent' => $stagePercent,
        ]);
    }

    private function grantCompleteBundle(
        User $student,
        Project $project
    ): void {
        DB::table('user_bundle_access')->insert([
            'user_id' => $student->id,
            'project_id' => $project->id,
            'bundle' => 'complete_project_zip',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
