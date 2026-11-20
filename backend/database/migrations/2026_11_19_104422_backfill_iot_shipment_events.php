<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Give pre-existing shipments a starting point in the tracking timeline.
     */
    public function up(): void
    {
        DB::table('iot_shipments')
            ->whereNotExists(function ($query) {
                $query->selectRaw('1')
                    ->from('iot_shipment_events')
                    ->whereColumn('iot_shipment_events.iot_shipment_id', 'iot_shipments.id');
            })
            ->orderBy('id')
            ->each(function ($shipment): void {
                $occurredAt = $shipment->delivered_at
                    ?? $shipment->dispatched_at
                    ?? $shipment->updated_at
                    ?? $shipment->created_at
                    ?? now();

                DB::table('iot_shipment_events')->insert([
                    'iot_shipment_id' => $shipment->id,
                    'updated_by' => null,
                    'status' => $shipment->status,
                    'title' => 'Existing shipment imported',
                    'description' => 'Shipment history started from the latest saved status.',
                    'occurred_at' => $occurredAt,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            });
    }

    public function down(): void
    {
        DB::table('iot_shipment_events')
            ->whereNull('updated_by')
            ->where('title', 'Existing shipment imported')
            ->delete();
    }
};
