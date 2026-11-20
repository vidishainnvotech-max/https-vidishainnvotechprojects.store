<?php

use App\Http\Controllers\Admin\AdminNotificationController;
use App\Http\Controllers\Admin\CategoryController;
use App\Http\Controllers\Admin\CouponController;
use App\Http\Controllers\Admin\DashboardController;
use App\Http\Controllers\Admin\DocumentationTemplateController;
use App\Http\Controllers\Admin\GroupController;
use App\Http\Controllers\Admin\IotShipmentController as AdminIotShipmentController;
use App\Http\Controllers\Admin\OrderController as AdminOrderController;
use App\Http\Controllers\Admin\PaymentGatewaySettingController;
use App\Http\Controllers\Admin\ProjectController;
use App\Http\Controllers\Admin\ProjectDocumentController;
use App\Http\Controllers\Admin\ProjectFileController;
use App\Http\Controllers\Admin\ProjectIdeaController as AdminProjectIdeaController;
use App\Http\Controllers\Admin\ProjectStageController;
use App\Http\Controllers\Admin\ReferralController as AdminReferralController;
use App\Http\Controllers\Admin\UserController;
use App\Http\Controllers\Admin\UserExportController;
use App\Http\Controllers\CollegeController;
use App\Http\Controllers\EmailVerificationController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\Public\CategoryController as PublicCategoryController;
use App\Http\Controllers\Public\PlanController as PublicPlanController;
use App\Http\Controllers\Public\ProjectController as PublicProjectController;
use App\Http\Controllers\Student\AuthController;
use App\Http\Controllers\Student\DocumentationTemplateController as StudentDocumentationTemplateController;
use App\Http\Controllers\Student\IotShipmentController as StudentIotShipmentController;
use App\Http\Controllers\Student\NotificationController as StudentNotificationController;
use App\Http\Controllers\Student\OrderController as StudentOrderController;
use App\Http\Controllers\Student\ProjectAccessController;
use App\Http\Controllers\Student\ProjectContentController;
use App\Http\Controllers\Student\ProjectFileDownloadController;
use App\Http\Controllers\Student\ProjectIdeaController;
use App\Http\Controllers\Student\ReferralController as StudentReferralController;
use Illuminate\Support\Facades\Route;

Route::get('/health', function () {
    return response()->json([
        'status' => 'ok',
        'message' => 'Laravel API is running',
    ]);
});

Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

Route::get('/email/verify/{id}/{hash}', [
    EmailVerificationController::class,
    'verify',
])->middleware('signed')->name('verification.verify');

Route::post('/email/resend', [
    EmailVerificationController::class,
    'resend',
])->middleware('throttle:3,1')->name('verification.send');

Route::post('/logout', [AuthController::class, 'logout'])
    ->middleware('auth:sanctum');

Route::get('/me', [AuthController::class, 'me'])
    ->middleware('auth:sanctum');

Route::get('/categories', [PublicCategoryController::class, 'index']);
Route::get('/projects', [PublicProjectController::class, 'index']);
Route::get('/projects/{slug}', [PublicProjectController::class, 'show']);
Route::get('/plans', [PublicPlanController::class, 'index']);
Route::get('/colleges', [CollegeController::class, 'index']);

Route::get('/admin/test', function () {
    return response()->json([
        'message' => 'Admin access granted.',
    ]);
})->middleware(['auth:sanctum', 'admin']);

Route::middleware(['auth:sanctum', 'admin'])
    ->prefix('admin')
    ->group(function () {
        Route::apiResource('categories', CategoryController::class);
        Route::post('projects/{project}', [ProjectController::class, 'update'])
            ->whereNumber('project');
        Route::apiResource('projects', ProjectController::class);
        Route::get('projects/{project}/files', [ProjectFileController::class, 'index'])
            ->whereNumber('project');
        Route::post('projects/{project}/stage-files', [ProjectFileController::class, 'storeStage'])
            ->whereNumber('project');
        Route::post('projects/{project}/complete-file', [ProjectFileController::class, 'storeComplete'])
            ->whereNumber('project');
        Route::delete('project-files/{projectFile}', [ProjectFileController::class, 'destroy'])
            ->whereNumber('projectFile');
        Route::apiResource('stages', ProjectStageController::class);
        Route::apiResource('documents', ProjectDocumentController::class);

        Route::get(
            'documentation-templates/colleges',
            [DocumentationTemplateController::class, 'colleges']
        );

        Route::get(
            'documentation-templates/groups',
            [DocumentationTemplateController::class, 'groups']
        );

        Route::get(
            'documentation-templates/projects',
            [DocumentationTemplateController::class, 'projects']
        );

        Route::get(
            'documentation-templates/stages',
            [DocumentationTemplateController::class, 'stages']
        );

        Route::apiResource(
            'documentation-templates',
            DocumentationTemplateController::class
        );

        Route::apiResource('coupons', CouponController::class);

        Route::get('users', [UserController::class, 'index']);
        Route::get('users/export', [UserExportController::class, 'export']);
        Route::get('users/{id}/access', [UserController::class, 'access']);
        Route::get('users/{id}', [UserController::class, 'show']);
        Route::put('users/{id}', [UserController::class, 'update'])->whereNumber('id');
        Route::delete('users/{id}', [UserController::class, 'destroy'])->whereNumber('id');

        Route::post('grant-access', [UserController::class, 'grantAccess']);
        Route::post('grant-stage-access', [UserController::class, 'grantStageAccess']);
        Route::delete('access/{id}', [UserController::class, 'revokeAccess']);

        Route::get('dashboard', [DashboardController::class, 'index']);

        Route::get('orders', [AdminOrderController::class, 'index']);
        Route::get('orders/{id}', [AdminOrderController::class, 'show'])
            ->whereNumber('id');
        Route::get('orders/{id}/invoice', [AdminOrderController::class, 'invoice'])
            ->whereNumber('id');

        Route::get('groups', [GroupController::class, 'index']);
        Route::get('groups/{id}', [GroupController::class, 'show']);
        Route::put('groups/{id}', [GroupController::class, 'update'])->whereNumber('id');
        Route::delete('groups/{id}', [GroupController::class, 'destroy'])->whereNumber('id');

        Route::get('iot-shipments', [AdminIotShipmentController::class, 'index']);
        Route::get('iot-shipments/{id}', [AdminIotShipmentController::class, 'show']);
        Route::patch('iot-shipments/{id}', [AdminIotShipmentController::class, 'update']);
        Route::get('notifications', [AdminNotificationController::class, 'index']);
        Route::patch('notifications/{id}/read', [AdminNotificationController::class, 'markRead']);
        Route::patch('notifications/read-all', [AdminNotificationController::class, 'markAllRead']);

        Route::get(
            'referrals',
            [AdminReferralController::class, 'index']
        )->name('admin.referrals.index');

        Route::get(
            'referrals/{referral}',
            [AdminReferralController::class, 'show']
        )->whereNumber('referral')
            ->name('admin.referrals.show');

        Route::get(
            'referral-codes',
            [AdminReferralController::class, 'codes']
        )->name('admin.referral-codes.index');

        Route::get(
            'referral-rewards',
            [AdminReferralController::class, 'rewards']
        )->name('admin.referral-rewards.index');

        Route::get('ideas', [AdminProjectIdeaController::class, 'index']);
        Route::get('ideas/{idea}/attachment', [AdminProjectIdeaController::class, 'download'])->whereNumber('idea');
        Route::get('ideas/{idea}', [AdminProjectIdeaController::class, 'show'])->whereNumber('idea');
        Route::patch('ideas/{idea}', [AdminProjectIdeaController::class, 'update'])->whereNumber('idea');

        Route::get('payment-gateway', [PaymentGatewaySettingController::class, 'show']);
        Route::put('payment-gateway', [PaymentGatewaySettingController::class, 'update']);
    });

Route::middleware('auth:sanctum')->group(function () {
    Route::get(
        '/student/documentation-templates',
        [StudentDocumentationTemplateController::class, 'index']
    );

    Route::get(
        '/student/documentation-templates/{id}/download',
        [StudentDocumentationTemplateController::class, 'download']
    )->whereNumber('id');

    Route::get('/my-projects', [ProjectAccessController::class, 'index']);
    Route::get('/my-projects/{id}', [ProjectAccessController::class, 'show']);

    Route::get(
        '/student/referrals',
        [StudentReferralController::class, 'index']
    )->name('student.referrals.index');

    Route::get('/download/document/{id}', [ProjectContentController::class, 'downloadDocument']);
    Route::get('/download/ppt/{id}', [ProjectContentController::class, 'downloadPpt']);
    Route::get('/stage/{id}/video', [ProjectContentController::class, 'watchStageVideo']);
    Route::get('/project-files/{projectFile}/download', ProjectFileDownloadController::class)
        ->whereNumber('projectFile');

    Route::post('/orders', [OrderController::class, 'store']);
    Route::get('/orders/active/{project}', [OrderController::class, 'activeOrder']);
    Route::get('/orders/{order}/next-payment', [OrderController::class, 'nextPayment']);
    Route::post('/orders/{order}/payments', [OrderController::class, 'createPayment']);
    Route::post(
        '/orders/{order}/payments/{payment}/verify-razorpay',
        [OrderController::class, 'verifyRazorpay']
    );

    Route::post(
        '/orders/{order}/payments/{payment}/test-success',
        [OrderController::class, 'testSuccess']
    );

    Route::get('/iot-shipments', [StudentIotShipmentController::class, 'index']);
    Route::post('/projects/{project}/iot-shipments', [StudentIotShipmentController::class, 'store']);
    Route::get('/iot-shipments/{shipment}', [StudentIotShipmentController::class, 'show']);
    Route::get('/student/orders', [StudentOrderController::class, 'index']);
    Route::get('/student/orders/{order}', [StudentOrderController::class, 'show'])
        ->whereNumber('order');
    Route::get('/student/orders/{order}/invoice', [StudentOrderController::class, 'invoice'])
        ->whereNumber('order');
    Route::get('/student/notifications', [StudentNotificationController::class, 'index']);
    Route::patch('/student/notifications/read-all', [StudentNotificationController::class, 'markAllRead']);
    Route::patch('/student/notifications/{id}/read', [StudentNotificationController::class, 'markRead'])
        ->whereNumber('id');

    Route::get('/student/ideas', [ProjectIdeaController::class, 'index']);
    Route::post('/student/ideas', [ProjectIdeaController::class, 'store']);
    Route::get('/student/ideas/{id}', [ProjectIdeaController::class, 'show'])->whereNumber('id');
});
