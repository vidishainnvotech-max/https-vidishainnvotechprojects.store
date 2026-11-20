<?php

namespace Tests\Feature\Admin;

use App\Models\Category;
use App\Models\Project;
use App\Models\ProjectFile;
use App\Models\ProjectStage;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ProjectFileControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_returns_401_when_project_files_are_requested_without_authentication(): void
    {
        $project = $this->createProject('unauthenticated');

        $this->getJson("/api/admin/projects/{$project->id}/files")
            ->assertUnauthorized();
    }

    public function test_returns_403_when_student_uploads_a_project_zip(): void
    {
        Storage::fake('local');

        $student = $this->createUser('student');
        $project = $this->createProject('student-forbidden');
        $stage = $this->createStage($project, 20);

        $this->actingAs($student, 'sanctum')
            ->withHeader('Accept', 'application/json')
            ->post("/api/admin/projects/{$project->id}/stage-files", [
                'stage_id' => $stage->id,
                'file' => $this->fakeZip('stage-20.zip', 'stage-20'),
            ])
            ->assertForbidden();

        $this->assertDatabaseCount('project_files', 0);
        $this->assertSame([], Storage::disk('local')->allFiles());
    }

    public function test_admin_uploads_a_private_stage_zip(): void
    {
        Storage::fake('local');

        $admin = $this->createUser('admin');
        $project = $this->createProject('stage-upload');
        $stage = $this->createStage($project, 20);

        $response = $this->actingAs($admin, 'sanctum')
            ->withHeader('Accept', 'application/json')
            ->post("/api/admin/projects/{$project->id}/stage-files", [
                'stage_id' => $stage->id,
                'file' => $this->fakeZip(
                    'expense-tracker-stage-20.zip',
                    'stage-source-v1'
                ),
            ]);

        $response->assertCreated()
            ->assertJsonPath('data.type', ProjectFile::TYPE_STAGE_ZIP)
            ->assertJsonPath('data.stage.id', $stage->id)
            ->assertJsonPath('data.stage.stage_percent', 20)
            ->assertJsonPath('data.original_name', 'expense-tracker-stage-20.zip')
            ->assertJsonMissingPath('data.storage_path');

        $projectFile = ProjectFile::query()->findOrFail(
            $response->json('data.id')
        );

        $this->assertSame($project->id, $projectFile->project_id);
        $this->assertSame($stage->id, $projectFile->project_stage_id);
        $this->assertSame($admin->id, $projectFile->uploaded_by);
        $this->assertSame(
            hash('sha256', 'stage-source-v1'),
            $projectFile->sha256
        );
        $this->assertStringStartsWith(
            "projects/{$project->id}/stages/20/",
            $projectFile->storage_path
        );
        Storage::disk('local')->assertExists($projectFile->storage_path);
    }

    public function test_rejects_a_non_zip_upload(): void
    {
        Storage::fake('local');

        $admin = $this->createUser('admin');
        $project = $this->createProject('invalid-upload');
        $stage = $this->createStage($project, 20);

        $this->actingAs($admin, 'sanctum')
            ->withHeader('Accept', 'application/json')
            ->post("/api/admin/projects/{$project->id}/stage-files", [
                'stage_id' => $stage->id,
                'file' => UploadedFile::fake()->createWithContent(
                    'payload.php',
                    '<?php echo "unsafe";'
                ),
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('file');

        $this->assertDatabaseCount('project_files', 0);
        $this->assertSame([], Storage::disk('local')->allFiles());
    }

    public function test_rejects_a_stage_from_another_project(): void
    {
        Storage::fake('local');

        $admin = $this->createUser('admin');
        $project = $this->createProject('selected-project');
        $otherProject = $this->createProject('other-project');
        $otherStage = $this->createStage($otherProject, 50);

        $this->actingAs($admin, 'sanctum')
            ->withHeader('Accept', 'application/json')
            ->post("/api/admin/projects/{$project->id}/stage-files", [
                'stage_id' => $otherStage->id,
                'file' => $this->fakeZip('stage-50.zip', 'stage-50'),
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('stage_id');

        $this->assertDatabaseCount('project_files', 0);
        $this->assertSame([], Storage::disk('local')->allFiles());
    }

    public function test_uploading_a_replacement_deactivates_and_removes_the_old_zip(): void
    {
        Storage::fake('local');

        $admin = $this->createUser('admin');
        $project = $this->createProject('replacement');
        $stage = $this->createStage($project, 75);

        $firstResponse = $this->actingAs($admin, 'sanctum')
            ->withHeader('Accept', 'application/json')
            ->post("/api/admin/projects/{$project->id}/stage-files", [
                'stage_id' => $stage->id,
                'file' => $this->fakeZip('stage-75-v1.zip', 'first-version'),
            ])
            ->assertCreated();

        $oldFile = ProjectFile::query()->findOrFail(
            $firstResponse->json('data.id')
        );
        $oldPath = $oldFile->storage_path;

        $secondResponse = $this->actingAs($admin, 'sanctum')
            ->withHeader('Accept', 'application/json')
            ->post("/api/admin/projects/{$project->id}/stage-files", [
                'stage_id' => $stage->id,
                'file' => $this->fakeZip('stage-75-v2.zip', 'second-version'),
            ])
            ->assertCreated();

        $newFile = ProjectFile::query()->findOrFail(
            $secondResponse->json('data.id')
        );

        $this->assertFalse($oldFile->fresh()->is_active);
        $this->assertTrue($newFile->is_active);
        $this->assertSame(1, ProjectFile::query()
            ->where('project_stage_id', $stage->id)
            ->where('is_active', true)
            ->count());
        Storage::disk('local')->assertMissing($oldPath);
        Storage::disk('local')->assertExists($newFile->storage_path);
    }

    public function test_complete_zip_is_uploaded_separately_from_stage_files(): void
    {
        Storage::fake('local');

        $admin = $this->createUser('admin');
        $project = $this->createProject('complete-upload');

        $response = $this->actingAs($admin, 'sanctum')
            ->withHeader('Accept', 'application/json')
            ->post("/api/admin/projects/{$project->id}/complete-file", [
                'file' => $this->fakeZip(
                    'expense-tracker-complete.zip',
                    'complete-source'
                ),
            ]);

        $response->assertCreated()
            ->assertJsonPath('data.type', ProjectFile::TYPE_COMPLETE_ZIP)
            ->assertJsonPath('data.stage', null)
            ->assertJsonMissingPath('data.storage_path');

        $projectFile = ProjectFile::query()->findOrFail(
            $response->json('data.id')
        );

        $this->assertNull($projectFile->project_stage_id);
        $this->assertStringStartsWith(
            "projects/{$project->id}/complete/",
            $projectFile->storage_path
        );
        Storage::disk('local')->assertExists($projectFile->storage_path);
    }

    public function test_list_returns_only_active_files_without_private_paths(): void
    {
        $admin = $this->createUser('admin');
        $project = $this->createProject('file-list');
        $stage = $this->createStage($project, 50);

        ProjectFile::factory()->for($project)->stage($stage)->create([
            'original_name' => 'old-stage.zip',
            'is_active' => false,
        ]);
        $stageFile = ProjectFile::factory()->for($project)->stage($stage)->create([
            'original_name' => 'current-stage.zip',
        ]);
        $completeFile = ProjectFile::factory()->for($project)->create([
            'original_name' => 'complete.zip',
        ]);

        $response = $this->actingAs($admin, 'sanctum')
            ->getJson("/api/admin/projects/{$project->id}/files");

        $response->assertOk()
            ->assertJsonPath('data.stage_files.0.id', $stageFile->id)
            ->assertJsonPath('data.complete_file.id', $completeFile->id)
            ->assertJsonCount(1, 'data.stage_files')
            ->assertJsonMissing(['original_name' => 'old-stage.zip'])
            ->assertJsonMissingPaths([
                'data.stage_files.0.storage_path',
                'data.complete_file.storage_path',
            ]);
    }

    public function test_admin_removes_project_zip_and_private_file(): void
    {
        Storage::fake('local');

        $admin = $this->createUser('admin');
        $project = $this->createProject('delete-file');
        $stage = $this->createStage($project, 100);
        $projectFile = ProjectFile::factory()
            ->for($project)
            ->stage($stage)
            ->create(['uploaded_by' => $admin->id]);
        Storage::disk('local')->put($projectFile->storage_path, 'source');

        $this->actingAs($admin, 'sanctum')
            ->deleteJson("/api/admin/project-files/{$projectFile->id}")
            ->assertOk();

        $this->assertModelMissing($projectFile);
        Storage::disk('local')->assertMissing($projectFile->storage_path);
    }

    public function test_deleting_stage_removes_its_private_zip(): void
    {
        Storage::fake('local');

        $admin = $this->createUser('admin');
        $project = $this->createProject('delete-stage');
        $stage = $this->createStage($project, 20);
        $projectFile = ProjectFile::factory()
            ->for($project)
            ->stage($stage)
            ->create(['uploaded_by' => $admin->id]);
        Storage::disk('local')->put($projectFile->storage_path, 'source');

        $this->actingAs($admin, 'sanctum')
            ->deleteJson("/api/admin/stages/{$stage->id}")
            ->assertOk();

        $this->assertModelMissing($stage);
        $this->assertModelMissing($projectFile);
        Storage::disk('local')->assertMissing($projectFile->storage_path);
    }

    public function test_deleting_project_removes_all_private_zips(): void
    {
        Storage::fake('local');

        $admin = $this->createUser('admin');
        $project = $this->createProject('delete-project');
        $stage = $this->createStage($project, 100);
        $stageFile = ProjectFile::factory()
            ->for($project)
            ->stage($stage)
            ->create(['uploaded_by' => $admin->id]);
        $completeFile = ProjectFile::factory()
            ->for($project)
            ->create(['uploaded_by' => $admin->id]);
        Storage::disk('local')->put($stageFile->storage_path, 'stage-source');
        Storage::disk('local')->put($completeFile->storage_path, 'complete-source');

        $this->actingAs($admin, 'sanctum')
            ->deleteJson("/api/admin/projects/{$project->id}")
            ->assertOk();

        $this->assertModelMissing($project);
        $this->assertModelMissing($stageFile);
        $this->assertModelMissing($completeFile);
        Storage::disk('local')->assertMissing($stageFile->storage_path);
        Storage::disk('local')->assertMissing($completeFile->storage_path);
    }

    private function createUser(string $role): User
    {
        return User::factory()->create([
            'mobile' => '9000000001',
            'college_id' => 'project-file-college',
            'role' => $role,
        ]);
    }

    private function createProject(string $suffix): Project
    {
        $category = Category::create([
            'name' => 'Project File Category '.$suffix,
            'slug' => 'project-file-category-'.$suffix,
        ]);

        return Project::create([
            'category_id' => $category->id,
            'title' => 'Project File Project '.$suffix,
            'slug' => 'project-file-project-'.$suffix,
            'abstract' => 'Project used to verify private ZIP administration.',
            'is_iot' => false,
            'is_active' => true,
        ]);
    }

    private function createStage(Project $project, int $stagePercent): ProjectStage
    {
        return ProjectStage::create([
            'project_id' => $project->id,
            'stage_percent' => $stagePercent,
            'semester' => 'Stage '.$stagePercent,
        ]);
    }

    private function fakeZip(string $name, string $content): UploadedFile
    {
        return UploadedFile::fake()->createWithContent($name, $content);
    }
}
