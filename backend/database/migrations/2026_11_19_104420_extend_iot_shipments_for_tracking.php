<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('iot_shipments', function (Blueprint $table) {
            $table->string('shipment_number', 50)->nullable()->after('id');
            $table->unsignedSmallInteger('quantity')->default(1)->after('kit_price');
            $table->string('tracking_url', 2048)->nullable()->after('tracking_number');
            $table->date('estimated_delivery_date')->nullable()->after('dispatched_at');
            $table->text('delivery_remarks')->nullable()->after('estimated_delivery_date');
        });

        DB::table('iot_shipments')->orderBy('id')->each(function ($shipment): void {
            DB::table('iot_shipments')
                ->where('id', $shipment->id)
                ->update([
                    'shipment_number' => sprintf('SHP-%08d', $shipment->id),
                    'status' => match ($shipment->status) {
                        'requested' => 'pending',
                        'approved' => 'packed',
                        'dispatched' => 'shipped',
                        default => $shipment->status,
                    },
                ]);
        });

        Schema::table('iot_shipments', function (Blueprint $table) {
            $table->unique('shipment_number');
            $table->index(['courier_name', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('iot_shipments', function (Blueprint $table) {
            $table->dropIndex(['courier_name', 'status']);
            $table->dropUnique(['shipment_number']);
            $table->dropColumn([
                'shipment_number',
                'quantity',
                'tracking_url',
                'estimated_delivery_date',
                'delivery_remarks',
            ]);
        });
    }
};
